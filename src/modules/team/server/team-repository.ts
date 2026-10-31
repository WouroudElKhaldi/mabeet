import type { Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

const membershipWithRole = { role: true } satisfies Prisma.MembershipInclude;

export function findMembershipById(db: Db, businessId: string, membershipId: string) {
  return db.membership.findFirst({
    where: { id: membershipId, businessId, status: "ACTIVE", business: { status: "ACTIVE" } },
    include: membershipWithRole,
  });
}

export function listUserWorkspaces(db: Db, userId: string) {
  return db.membership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { business: { select: { id: true, name: true, slug: true } }, role: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export function listMembers(db: Db, businessId: string) {
  return db.membership.findMany({
    where: { businessId, status: { not: "REMOVED" }, isDeleted: false },
    include: {
      user: { select: { id: true, name: true, email: true } },
      role: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Any membership of this user in this business, including removed ones. */
export function findMembershipOfUser(db: Db, userId: string, businessId: string) {
  return db.membership.findUnique({ where: { userId_businessId: { userId, businessId } } });
}

export function upsertMembership(db: Db, data: { userId: string; businessId: string; roleId: string }) {
  return db.membership.upsert({
    where: { userId_businessId: { userId: data.userId, businessId: data.businessId } },
    create: data,
    update: { roleId: data.roleId, status: "ACTIVE", isDeleted: false },
  });
}

export async function updateMembership(
  db: Db,
  businessId: string,
  membershipId: string,
  data: Prisma.MembershipUncheckedUpdateManyInput,
) {
  const { count } = await db.membership.updateMany({ where: { id: membershipId, businessId }, data });
  return count > 0;
}

export function findRole(db: Db, businessId: string, roleId: string) {
  return db.role.findFirst({ where: { id: roleId, businessId, isDeleted: false } });
}

export function listRoles(db: Db, businessId: string) {
  return db.role.findMany({
    where: { businessId, isDeleted: false },
    include: { _count: { select: { memberships: { where: { status: "ACTIVE" } } } } },
    orderBy: [{ isOwner: "desc" }, { name: "asc" }],
  });
}

/** Creates a role, or brings back a deleted one with the same name (names are unique in a business). */
export async function createRole(db: Db, data: Prisma.RoleUncheckedCreateInput) {
  const deleted = await db.role.findFirst({
    where: { businessId: data.businessId, name: data.name, isDeleted: true },
    select: { id: true },
  });
  if (!deleted) return db.role.create({ data });
  return db.role.update({ where: { id: deleted.id }, data: { ...data, isDeleted: false } });
}

export async function updateRole(
  db: Db,
  businessId: string,
  roleId: string,
  data: { name?: string; description?: string | null; permissions?: string[] },
) {
  const { count } = await db.role.updateMany({
    where: { id: roleId, businessId, isOwner: false, isDeleted: false },
    data,
  });
  return count > 0;
}

/** Marks a role deleted. Removed memberships may still point at it; they grant nothing. */
export async function deleteRole(db: Db, businessId: string, roleId: string) {
  const { count } = await db.role.updateMany({
    where: { id: roleId, businessId, isOwner: false, isDeleted: false },
    data: { isDeleted: true },
  });
  return count > 0;
}

export function countMembersWithRole(db: Db, roleId: string) {
  return db.membership.count({ where: { roleId, status: { not: "REMOVED" } } });
}
