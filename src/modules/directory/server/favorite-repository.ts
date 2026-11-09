import type { Db } from "@/server/db/client";

// The places a guest saved. Nothing is ever deleted: unsaving marks the row, and saving the same place again brings
// that row back, so one guest never collects two rows for one place (the pair is unique in the database).

/** Saves a place for a guest, or brings back the one they had saved before. */
export function saveFavorite(db: Db, userId: string, businessId: string) {
  return db.favorite.upsert({
    where: { userId_businessId: { userId, businessId } },
    create: { userId, businessId },
    update: { isDeleted: false },
  });
}

/** Takes a place off a guest's list. Nothing happens if it was not on it. */
export function removeFavorite(db: Db, userId: string, businessId: string) {
  return db.favorite.updateMany({
    where: { userId, businessId, isDeleted: false },
    data: { isDeleted: true },
  });
}

/** Whether this guest has this place saved. */
export async function isFavorite(db: Db, userId: string, businessId: string): Promise<boolean> {
  const saved = await db.favorite.findFirst({
    where: { userId, businessId, isDeleted: false },
    select: { id: true },
  });
  return saved !== null;
}

/** The places a guest has saved, the newest first. */
export async function listFavoriteIds(db: Db, userId: string): Promise<string[]> {
  const saved = await db.favorite.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: { businessId: true },
  });
  return saved.map((favorite) => favorite.businessId);
}
