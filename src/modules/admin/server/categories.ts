import type { ListingKind } from "@prisma/client";
import type { z } from "zod";
import { recordPlatformAction } from "@/modules/audit/server";
import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { duplicateAsConflict } from "@/server/db/constraint-errors";
import { conflict, notFound } from "@/server/errors";
import type { categoryInput, categoryUpdate } from "../schemas";
import { pageOf } from "@/utils/paging";
import { type CategoryFilters } from "./category-repository";
import * as categories from "./category-repository";

// What other modules read of the browse categories: a place picks its own from them, and guests browse by them.

/** The live categories of one kind (`HOME` for places), in the admin's order. */
export function listCategories(kind: ListingKind) {
  return categories.listCategories(prisma, kind);
}

function logCategory(actor: PlatformActor, action: string, slug: string) {
  return recordPlatformAction(actor, { businessId: null, action, entity: "category", entityId: slug });
}

/** Every category with how many places and experiences use it, for the admin's list. */
export function listCategoriesForAdmin(actor: PlatformActor) {
  requirePlatformAdmin(actor);
  return categories.listCategoriesWithUse(prisma);
}

/** One page of the categories for the admin's table, searched and filtered by kind, each with how much it is used. */
export async function listCategoryPage(actor: PlatformActor, filters: CategoryFilters, page = 1) {
  requirePlatformAdmin(actor);
  const total = await categories.countCategories(prisma, filters);
  const { skip, take, ...paging } = pageOf(total, page);
  const rows = await categories.listCategoriesWithUse(prisma, filters, { skip, take });
  return {
    total,
    ...paging,
    categories: rows.map(({ _count, ...category }) => ({
      ...category,
      uses: _count.businesses + _count.offerings,
    })),
  };
}

export async function createCategory(actor: PlatformActor, input: z.infer<typeof categoryInput>) {
  requirePlatformAdmin(actor);
  await duplicateAsConflict("A category with this slug already exists", () =>
    categories.createCategory(prisma, input),
  );
  await logCategory(actor, "category.created", input.slug);
}

export async function updateCategory(
  actor: PlatformActor,
  slug: string,
  input: z.infer<typeof categoryUpdate>,
) {
  requirePlatformAdmin(actor);
  if (!(await categories.updateCategory(prisma, slug, input))) throw notFound("Category");
  await logCategory(actor, "category.updated", slug);
}

/** A category still used by places or experiences cannot go: they would silently lose it. */
export async function deleteCategory(actor: PlatformActor, slug: string) {
  requirePlatformAdmin(actor);
  const use = await categories.countCategoryUse(prisma, slug);
  if (!use) throw notFound("Category");
  if (use._count.businesses + use._count.offerings > 0) {
    throw conflict("Places or experiences still use this category. Move them first.");
  }
  await categories.deleteCategory(prisma, slug);
  await logCategory(actor, "category.deleted", slug);
}
