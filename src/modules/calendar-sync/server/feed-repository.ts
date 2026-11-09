import type { FeedSource } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

// The Airbnb, Booking.com and other calendar links a room reads. The nights they bring are IMPORTED night rows, which
// the booking engine writes under the room lock; this table only says where to read them and how the last read went.

const feedFields = {
  id: true,
  businessId: true,
  roomId: true,
  url: true,
  source: true,
  lastSyncedAt: true,
  lastError: true,
  createdAt: true,
} as const;

export function listFeeds(db: Db, businessId: string, roomIds?: readonly string[]) {
  return db.calendarFeed.findMany({
    where: { businessId, isDeleted: false, ...(roomIds && { roomId: { in: [...roomIds] } }) },
    orderBy: { createdAt: "asc" },
    select: feedFields,
  });
}

export function findFeed(db: Db, businessId: string, feedId: string) {
  return db.calendarFeed.findFirst({
    where: { id: feedId, businessId, isDeleted: false },
    select: feedFields,
  });
}

/** The same link on the same room, if it is connected already, so connecting it twice never reads it twice. */
export function findFeedByUrl(db: Db, businessId: string, roomId: string, url: string) {
  return db.calendarFeed.findFirst({
    where: { businessId, roomId, url, isDeleted: false },
    select: { id: true },
  });
}

export function createFeed(
  db: Db,
  feed: { businessId: string; roomId: string; url: string; source: FeedSource },
) {
  return db.calendarFeed.create({ data: feed, select: feedFields });
}

/** Marks the link deleted. Returns false when there was no such live link. */
export async function deleteFeed(tx: Tx, businessId: string, feedId: string): Promise<boolean> {
  const { count } = await tx.calendarFeed.updateMany({
    where: { id: feedId, businessId, isDeleted: false },
    data: { isDeleted: true },
  });
  return count > 0;
}

/** Links not read since `staleBefore`, never-read ones first, then the longest waiting. */
export function listFeedsDueForSync(db: Db, staleBefore: Date, take: number) {
  return db.calendarFeed.findMany({
    where: {
      isDeleted: false,
      room: { isDeleted: false },
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: staleBefore } }],
    },
    orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
    take,
    select: { id: true, businessId: true },
  });
}

export function recordFeedResult(
  db: Db,
  feedId: string,
  result: { lastSyncedAt: Date; lastError: string | null },
) {
  return db.calendarFeed.updateMany({ where: { id: feedId, isDeleted: false }, data: result });
}
