import type { ListingKind, Prisma } from "@prisma/client";
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

const USE = {
  select: { businesses: { where: { isDeleted: false } }, offerings: { where: { isDeleted: false } } },
} as const;

/** Every live category with how many places and experiences use it, for the admin. */
export function listCategoriesWithUse(db: Db) {
  return db.category.findMany({
    where: { isDeleted: false },
    orderBy: [{ kind: "asc" }, { position: "asc" }, { slug: "asc" }],
    select: { slug: true, kind: true, nameEn: true, nameAr: true, icon: true, position: true, _count: USE },
  });
}

/** Creates a category, or brings back a deleted one with the same slug (the slug is its key). */
export async function createCategory(db: Db, data: Prisma.CategoryCreateInput) {
  const { count } = await db.category.updateMany({
    where: { slug: data.slug, isDeleted: true },
    data: { ...data, isDeleted: false },
  });
  if (count === 0) await db.category.create({ data });
}

/** False when there is no such live category. */
export async function updateCategory(db: Db, slug: string, data: Prisma.CategoryUpdateInput) {
  const { count } = await db.category.updateMany({ where: { slug, isDeleted: false }, data });
  return count > 0;
}

export function countCategoryUse(db: Db, slug: string) {
  return db.category.findFirst({ where: { slug, isDeleted: false }, select: { _count: USE } });
}

export function deleteCategory(db: Db, slug: string) {
  return db.category.update({ where: { slug }, data: { isDeleted: true } });
}
