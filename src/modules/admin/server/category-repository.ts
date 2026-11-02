import type { ListingKind } from "@prisma/client";
import type { Db } from "@/server/db/client";

// The browse categories the platform admin manages (mountain, beach, hiking…), each for places, experiences or
// services.

/** The live categories of one kind, in the admin's order. */
export function listCategories(db: Db, kind: ListingKind) {
  return db.category.findMany({
    where: { kind, isDeleted: false },
    orderBy: [{ position: "asc" }, { slug: "asc" }],
    select: { slug: true, nameEn: true, nameAr: true, icon: true },
  });
}
