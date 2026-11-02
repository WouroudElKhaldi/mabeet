import type { ListingKind } from "@prisma/client";
import { prisma } from "@/server/db/client";
import * as categories from "./category-repository";

// What other modules read of the browse categories: a place picks its own from them, and guests browse by them.

/** The live categories of one kind (`HOME` for places), in the admin's order. */
export function listCategories(kind: ListingKind) {
  return categories.listCategories(prisma, kind);
}
