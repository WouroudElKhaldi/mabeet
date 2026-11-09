import type { Db } from "@/server/db/client";

// The two reads every workspace request makes to learn who is acting. They live in the shared kernel, not the team
// module, because the route wrapper needs them before any module runs.

export function findActiveMembership(db: Db, userId: string, businessId: string) {
  return db.membership.findFirst({
    where: { userId, businessId, status: "ACTIVE", business: { status: "ACTIVE" } },
    include: { role: true },
  });
}

/** Whether this user is a platform admin, read fresh rather than from the sign-in cookie. */
export async function isPlatformAdmin(db: Db, userId: string) {
  const user = await db.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: { platformRole: true },
  });
  return user?.platformRole === "SUPER_ADMIN";
}

/** Whether this user is a platform admin, and whether the business exists (suspended ones included). */
export async function findAdminAccess(db: Db, userId: string, businessId: string) {
  const [user, business] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { platformRole: true } }),
    db.business.findUnique({ where: { id: businessId }, select: { id: true } }),
  ]);
  return user?.platformRole === "SUPER_ADMIN" && business !== null;
}
