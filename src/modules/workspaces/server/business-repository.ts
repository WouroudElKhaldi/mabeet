import type { Prisma } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

export function slugExists(db: Db, slug: string) {
  return db.business.count({ where: { slug } }).then((count) => count > 0);
}

export interface NewBusinessWithOwner {
  business: Omit<Prisma.BusinessCreateInput, "roles" | "memberships">;
  ownerUserId: string;
  starterRoles: ReadonlyArray<{ name: string; description: string; permissions: string[] }>;
}

export async function createBusinessWithOwner(tx: Tx, input: NewBusinessWithOwner) {
  const business = await tx.business.create({
    data: {
      ...input.business,
      roles: { create: input.starterRoles.map((role) => ({ ...role })) },
    },
  });
  await tx.role.create({
    data: {
      businessId: business.id,
      name: "Owner",
      description: "Full access",
      permissions: [],
      isOwner: true,
      memberships: { create: { userId: input.ownerUserId, businessId: business.id } },
    },
  });
  return business;
}

/** A place guests can book: live, not deleted, found by its public link. */
export function findBookableBusinessBySlug(db: Db, slug: string) {
  return db.business.findFirst({
    where: { slug, status: "ACTIVE", isDeleted: false },
    select: {
      id: true,
      name: true,
      currency: true,
      bookingMode: true,
      bookingUnit: true,
      holdHours: true,
    },
  });
}
