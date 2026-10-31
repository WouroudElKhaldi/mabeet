import type { Db, Tx } from "@/server/db/client";

// Invitations to join a business's team. The team's own reads filter by businessId; the invited person finds
// theirs by the secret token in the link.

const invitationFields = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
  invitedBy: { select: { name: true } },
} as const;

export function createInvitation(
  db: Db,
  data: {
    businessId: string;
    roleId: string;
    invitedById: string;
    name: string;
    email: string;
    phone: string;
    locale: string;
    token: string;
    expiresAt: Date;
  },
) {
  return db.invitation.create({ data, select: { id: true } });
}

export function listInvitations(db: Db, businessId: string) {
  return db.invitation.findMany({
    where: { businessId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: invitationFields,
  });
}

/** A pending invitation for this email that has not run out yet, if the team already sent one. */
export function findOpenInvitation(db: Db, businessId: string, email: string, now: Date) {
  return db.invitation.findFirst({
    where: { businessId, email, status: "PENDING", expiresAt: { gt: now }, isDeleted: false },
    select: { id: true },
  });
}

/** What the invitation page shows, by the link's token. */
export function findInvitationByToken(db: Db, token: string) {
  return db.invitation.findFirst({
    where: { token, isDeleted: false },
    select: {
      ...invitationFields,
      businessId: true,
      roleId: true,
      business: { select: { name: true, status: true } },
    },
  });
}

/** What the invitation emails need, read fresh by the notify job. */
export function findInvitationForNotice(db: Db, invitationId: string) {
  return db.invitation.findFirst({
    where: { id: invitationId, isDeleted: false },
    select: {
      id: true,
      name: true,
      email: true,
      locale: true,
      token: true,
      status: true,
      expiresAt: true,
      businessId: true,
      business: { select: { name: true } },
      role: { select: { name: true } },
      invitedBy: { select: { name: true, email: true, locale: true, isDeleted: true } },
      acceptedBy: { select: { name: true } },
    },
  });
}

/** Marks a pending invitation cancelled. False when it is not pending (accepted, cancelled or expired). */
export async function cancelInvitation(db: Db, businessId: string, invitationId: string) {
  const { count } = await db.invitation.updateMany({
    where: { id: invitationId, businessId, status: "PENDING", isDeleted: false },
    data: { status: "CANCELLED" },
  });
  return count > 0;
}

export async function markExpired(db: Db, invitationId: string) {
  await db.invitation.updateMany({
    where: { id: invitationId, status: "PENDING" },
    data: { status: "EXPIRED" },
  });
}

/**
 * Accepts a pending, unexpired invitation for this user, once: when two tabs accept at the same time, only one
 * gets true. Run in a transaction with the membership it creates.
 */
export async function markAccepted(tx: Tx, invitationId: string, userId: string, now: Date) {
  const { count } = await tx.invitation.updateMany({
    where: { id: invitationId, status: "PENDING", expiresAt: { gt: now }, isDeleted: false },
    data: { status: "ACCEPTED", acceptedById: userId, acceptedAt: now },
  });
  return count > 0;
}

/** Pending invitations that would hand out this role, so the role is not deleted under them. */
export function countPendingWithRole(db: Db, roleId: string, now: Date) {
  return db.invitation.count({
    where: { roleId, status: "PENDING", expiresAt: { gt: now }, isDeleted: false },
  });
}
