import type { InvitationStatus } from "@prisma/client";
import type { z } from "zod";
import { createVerifiedAccount, findAccountByEmail } from "@/modules/accounts/server";
import { recordAction, recordPersonAndBusiness } from "@/modules/audit/server";
import { assertPlanAllowsAnother } from "@/modules/billing/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { conflict, forbidden, notFound } from "@/server/errors";
import { addDays } from "@/utils/dates";
import { secureToken } from "@/utils/tokens";
import type { invitationInput } from "../schemas";
import * as invitations from "./invitation-repository";
import { notifyInvitation, notifyInvitationAccepted } from "./team-notifications";
import * as team from "./team-repository";
import { findAssignableRole } from "./team-service";

// A host adds someone to the team by inviting them: name, email, phone and the role they will have. The link lets
// the person register (or sign in, if they have an account) and join with exactly that role; they never pick it.

const INVITATION_DAYS = 7;

type InvitationInput = z.infer<typeof invitationInput>;

/** A pending invitation whose link ran out is shown, and treated, as expired. */
const statusAt = (invitation: { status: InvitationStatus; expiresAt: Date }, now: Date): InvitationStatus =>
  invitation.status === "PENDING" && invitation.expiresAt <= now ? "EXPIRED" : invitation.status;

export async function inviteMember(
  ctx: TenantContext,
  input: InvitationInput,
  locale: string,
  now = new Date(),
) {
  requirePermission(ctx, "team.manage");
  const role = await findAssignableRole(ctx, input.roleId);
  const email = input.email.trim().toLowerCase();
  const user = await findAccountByEmail(email);
  const membership = user ? await team.findMembershipOfUser(prisma, user.id, ctx.businessId) : null;
  if (membership && membership.status !== "REMOVED") {
    throw conflict("This person is already on the team. Change their role from the team list instead.");
  }
  if (await invitations.findOpenInvitation(prisma, ctx.businessId, email, now)) {
    throw conflict("This person already has an invitation waiting. Cancel it to send a new one.");
  }
  await assertPlanAllowsAnother(ctx.businessId, "members");
  const invitation = await runInTransaction(async (tx) => {
    const created = await invitations.createInvitation(tx, {
      businessId: ctx.businessId,
      roleId: role.id,
      invitedById: ctx.userId,
      name: input.name.trim(),
      email,
      phone: input.phone,
      locale,
      token: secureToken(),
      expiresAt: addDays(now, INVITATION_DAYS),
    });
    await recordAction(ctx, "member.invited", "invitation", created.id, tx);
    return created;
  });
  notifyInvitation(invitation.id);
  return invitation;
}

export async function listTeamInvitations(ctx: TenantContext, now = new Date()) {
  requirePermission(ctx, "team.manage");
  const rows = await invitations.listInvitations(prisma, ctx.businessId);
  return rows.map((invitation) => ({ ...invitation, status: statusAt(invitation, now) }));
}

export async function cancelInvitation(ctx: TenantContext, invitationId: string) {
  requirePermission(ctx, "team.manage");
  await runInTransaction(async (tx) => {
    if (!(await invitations.cancelInvitation(tx, ctx.businessId, invitationId))) {
      throw notFound("Invitation");
    }
    await recordAction(ctx, "member.invitation_cancelled", "invitation", invitationId, tx);
  });
}

// ---------- The invited person ----------

type FoundInvitation = NonNullable<Awaited<ReturnType<typeof invitations.findInvitationByToken>>>;

async function findInvitation(token: string) {
  const invitation = await invitations.findInvitationByToken(prisma, token);
  // A suspended business takes no one in; its invitations look like any unknown link.
  if (!invitation || invitation.business.status !== "ACTIVE") return null;
  return invitation;
}

/** The invitation page: who invited them, where, with which role, and whether they already have an account. */
export async function getInvitation(token: string, now = new Date()) {
  const invitation = await findInvitation(token);
  if (!invitation) return null;
  const account = await findAccountByEmail(invitation.email);
  return {
    status: statusAt(invitation, now),
    name: invitation.name,
    email: invitation.email,
    phone: invitation.phone,
    businessId: invitation.businessId,
    businessName: invitation.business.name,
    roleName: invitation.role.name,
    invitedByName: invitation.invitedBy.name,
    expiresAt: invitation.expiresAt,
    hasAccount: account !== null,
  };
}

async function findOpenInvitation(token: string, now: Date): Promise<FoundInvitation> {
  const invitation = await findInvitation(token);
  if (!invitation) throw notFound("Invitation");
  const status = statusAt(invitation, now);
  if (status === "EXPIRED") {
    await invitations.markExpired(prisma, invitation.id);
    throw conflict("This invitation has expired. Ask the host to send a new one.");
  }
  if (status !== "PENDING") throw conflict("This invitation can't be used any more.");
  return invitation;
}

/**
 * Everything that could stop the person joining, checked before anything is written: a new person's account is
 * only created once they are sure to get in.
 */
async function assertCanJoin(invitation: FoundInvitation, userId: string | null) {
  const membership = userId ? await team.findMembershipOfUser(prisma, userId, invitation.businessId) : null;
  if (membership && membership.status !== "REMOVED") throw conflict("You are already on this team.");
  if (!(await team.findRole(prisma, invitation.businessId, invitation.roleId))) {
    throw conflict("The role on this invitation no longer exists. Ask the host to send a new one.");
  }
  // Checked again here: the team may have filled up since the invitation was sent.
  await assertPlanAllowsAnother(invitation.businessId, "members");
}

/** Creates the membership with the invitation's role, once, and records it for the person and the business. */
async function join(invitation: FoundInvitation, userId: string, now: Date) {
  await runInTransaction(async (tx) => {
    if (!(await invitations.markAccepted(tx, invitation.id, userId, now))) {
      throw conflict("This invitation can't be used any more.");
    }
    await team.upsertMembership(tx, { userId, businessId: invitation.businessId, roleId: invitation.roleId });
    await recordPersonAndBusiness(tx, {
      userId,
      businessId: invitation.businessId,
      action: "member.invitation_accepted",
      entity: "invitation",
      entityId: invitation.id,
    });
  });
  notifyInvitationAccepted(invitation.id);
  return { businessId: invitation.businessId };
}

/**
 * Someone without an account registers from the invitation: the account is created with the invited email
 * (already verified by the link) and they join the team. The browser then signs in with the new password.
 */
export async function registerFromInvitation(
  token: string,
  input: { name: string; phone: string; password: string },
  locale: string,
  now = new Date(),
) {
  const invitation = await findOpenInvitation(token, now);
  if (await findAccountByEmail(invitation.email)) {
    throw conflict("You already have an account with this email. Sign in to accept the invitation.");
  }
  await assertCanJoin(invitation, null);
  const user = await createVerifiedAccount({ ...input, email: invitation.email, locale });
  return { ...(await join(invitation, user.id, now)), email: invitation.email };
}

/** A signed-in person accepts an invitation sent to their own email. */
export async function acceptInvitation(user: { id: string; email: string }, token: string, now = new Date()) {
  const invitation = await findOpenInvitation(token, now);
  if (invitation.email !== user.email.toLowerCase()) {
    throw forbidden("This invitation was sent to another email address.");
  }
  await assertCanJoin(invitation, user.id);
  return join(invitation, user.id, now);
}
