import type { Membership, Role } from "@prisma/client";
import { ALL_PERMISSIONS, toPermissions } from "@/config/permissions";
import { prisma } from "@/server/db/client";
import { findActiveMembership, findAdminAccess } from "./membership-repository";
import type { Channel, TenantContext } from "./tenant-context";

type MembershipWithRole = Membership & { role: Role };

function contextFrom(membership: MembershipWithRole, channel: Channel): TenantContext {
  return {
    userId: membership.userId,
    businessId: membership.businessId,
    membershipId: membership.id,
    isOwner: membership.role.isOwner,
    permissions: membership.role.isOwner
      ? new Set(ALL_PERMISSIONS)
      : toPermissions(membership.role.permissions),
    channel,
  };
}

/**
 * Resolves the acting member for a signed-in user. A platform admin who isn't a member still gets in, with every
 * permission, so they can manage any business from their dashboard; only on the website, never through AI keys
 * or tokens. Returns null for anyone else who isn't an active member.
 */
export async function resolveContext(userId: string, businessId: string, channel: Channel = "web") {
  const membership = await findActiveMembership(prisma, userId, businessId);
  if (membership) return contextFrom(membership, channel);
  if (channel !== "web" || !(await findAdminAccess(prisma, userId, businessId))) return null;
  return {
    userId,
    businessId,
    membershipId: "",
    isOwner: true,
    permissions: new Set(ALL_PERMISSIONS),
    channel,
    platformAdmin: true,
  } satisfies TenantContext;
}
