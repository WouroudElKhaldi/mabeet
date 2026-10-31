import type { z } from "zod";
import { findUngrantable, type Permission, toPermissions } from "@/config/permissions";
import { recordAction } from "@/modules/audit/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { duplicateAsConflict } from "@/server/db/constraint-errors";
import { conflict, forbidden, notFound } from "@/server/errors";
import type { roleInput } from "../schemas";
import { countPendingWithRole } from "./invitation-repository";
import * as team from "./team-repository";

export function listWorkspaces(userId: string) {
  return team.listUserWorkspaces(prisma, userId);
}

// ---------- Roles ----------

type RoleInput = z.infer<typeof roleInput>;

const ROLE_NAME_TAKEN = "A role with this name already exists";

function assertCanGrant(ctx: TenantContext, permissions: readonly Permission[]): void {
  const missing = findUngrantable(ctx.permissions, permissions);
  if (missing.length > 0)
    throw forbidden(`You cannot grant permissions you do not have: ${missing.join(", ")}`);
}

export function listRoles(ctx: TenantContext) {
  requirePermission(ctx, "roles.manage");
  return team.listRoles(prisma, ctx.businessId);
}

export async function createRole(ctx: TenantContext, input: RoleInput) {
  requirePermission(ctx, "roles.manage");
  assertCanGrant(ctx, input.permissions);
  return runInTransaction(async (tx) => {
    const role = await duplicateAsConflict(ROLE_NAME_TAKEN, () =>
      team.createRole(tx, { ...input, businessId: ctx.businessId }),
    );
    await recordAction(ctx, "role.created", "role", role.id, tx);
    return role;
  });
}

export async function updateRole(ctx: TenantContext, roleId: string, input: Partial<RoleInput>) {
  requirePermission(ctx, "roles.manage");
  const role = await team.findRole(prisma, ctx.businessId, roleId);
  if (!role) throw notFound("Role");
  if (role.isOwner) throw forbidden("The owner role cannot be changed");
  assertCanGrant(ctx, toPermissionList(role.permissions));
  if (input.permissions) assertCanGrant(ctx, input.permissions);
  await runInTransaction(async (tx) => {
    await duplicateAsConflict(ROLE_NAME_TAKEN, () => team.updateRole(tx, ctx.businessId, roleId, input));
    await recordAction(ctx, "role.updated", "role", roleId, tx);
  });
}

export async function deleteRole(ctx: TenantContext, roleId: string, now = new Date()) {
  requirePermission(ctx, "roles.manage");
  const role = await team.findRole(prisma, ctx.businessId, roleId);
  if (!role) throw notFound("Role");
  if (role.isOwner) throw forbidden("The owner role cannot be deleted");
  if ((await team.countMembersWithRole(prisma, roleId)) > 0) {
    throw conflict("Move the members on this role to another role first");
  }
  if ((await countPendingWithRole(prisma, roleId, now)) > 0) {
    throw conflict("Cancel the invitations waiting for this role first");
  }
  await runInTransaction(async (tx) => {
    await team.deleteRole(tx, ctx.businessId, roleId);
    await recordAction(ctx, "role.deleted", "role", roleId, tx);
  });
}

function toPermissionList(values: readonly string[]): Permission[] {
  return [...toPermissions(values)];
}

// ---------- Members ----------

export function listMembers(ctx: TenantContext) {
  requirePermission(ctx, "team.manage");
  return team.listMembers(prisma, ctx.businessId);
}

/** Only an owner may hand out the owner role; anyone else may only assign roles within their own permissions. */
export async function findAssignableRole(ctx: TenantContext, roleId: string) {
  const role = await team.findRole(prisma, ctx.businessId, roleId);
  if (!role) throw notFound("Role");
  if (role.isOwner && !ctx.isOwner) throw forbidden("Only an owner can make someone an owner");
  if (!role.isOwner) assertCanGrant(ctx, toPermissionList(role.permissions));
  return role;
}

async function findManageableMember(ctx: TenantContext, membershipId: string) {
  requirePermission(ctx, "team.manage");
  if (membershipId === ctx.membershipId) throw forbidden("You cannot change your own access");
  const member = await team.findMembershipById(prisma, ctx.businessId, membershipId);
  if (!member) throw notFound("Member");
  if (member.role.isOwner && !ctx.isOwner) throw forbidden("Only an owner can change another owner");
  return member;
}

export async function changeMemberRole(ctx: TenantContext, membershipId: string, roleId: string) {
  await findManageableMember(ctx, membershipId);
  await findAssignableRole(ctx, roleId);
  await runInTransaction(async (tx) => {
    await team.updateMembership(tx, ctx.businessId, membershipId, { roleId });
    await recordAction(ctx, "member.role_changed", "membership", membershipId, tx);
  });
}

export async function removeMember(ctx: TenantContext, membershipId: string) {
  await findManageableMember(ctx, membershipId);
  await runInTransaction(async (tx) => {
    await team.updateMembership(tx, ctx.businessId, membershipId, { status: "REMOVED" });
    await recordAction(ctx, "member.removed", "membership", membershipId, tx);
  });
}
