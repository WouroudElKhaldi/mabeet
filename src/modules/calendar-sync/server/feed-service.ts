import type { FeedSource } from "@prisma/client";
import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { type Db, prisma, type Tx } from "@/server/db/client";
import { conflict } from "@/server/errors";
import { FEED_STALE_AFTER_MS } from "../feed-health";
import { buildExportFeed, type ExportEvent } from "./build-feed";
import * as feeds from "./feed-repository";
import { type FeedEvent, type ParseWindow, parseFeed } from "./parse-feed";
import { assertPublicHttpsUrl, FETCH_TIMEOUT_MS, fetchCalendarText } from "./safe-fetch";

// Calendar links: where each room reads Airbnb and Booking.com, how each read went, and the file our own link
// serves. This module never touches night rows and never calls the booking engine: the booking engine calls it (the
// scheduled sync, "Sync now", the read before a booking or a confirmation) and writes the IMPORTED rows itself, under
// the room lock. These are plain reads and writes: the booking engine's services check the member's permissions.

/** The live links of a place, or of some of its rooms. */
export function listRoomFeeds(businessId: string, roomIds?: readonly string[], db: Db = prisma) {
  return feeds.listFeeds(db, businessId, roomIds);
}

export function findFeed(businessId: string, feedId: string, db: Db = prisma) {
  return feeds.findFeed(db, businessId, feedId);
}

/**
 * Saves a new link for a room once it is a public https address. The same link twice on one room is refused, so a
 * stay is never read twice into the same room.
 */
export async function saveFeedLink(
  feed: { businessId: string; roomId: string; url: string; source: FeedSource },
  db: Db = prisma,
) {
  await assertPublicHttpsUrl(feed.url);
  if (await feeds.findFeedByUrl(db, feed.businessId, feed.roomId, feed.url)) {
    throw conflict("This calendar link is already connected to this room.");
  }
  return feeds.createFeed(db, feed);
}

/** Disconnects a link. The booking engine frees the nights it brought in the same transaction. */
export function deleteFeedLink(tx: Tx, businessId: string, feedId: string) {
  return feeds.deleteFeed(tx, businessId, feedId);
}

/** Links not read since `staleBefore`, at most `take`, the longest waiting first. */
export function listFeedsDue(staleBefore: Date, take: number) {
  return feeds.listFeedsDueForSync(prisma, staleBefore, take);
}

/** How a read went: when, and the error the host sees under the link (null when it worked). */
export function saveFeedResult(feedId: string, result: { lastSyncedAt: Date; lastError: string | null }) {
  return feeds.recordFeedResult(prisma, feedId, result);
}

/**
 * Downloads a link and reads its stays inside the window. `timeoutMs` is shorter when a guest is waiting on it.
 * Throws an `invalid` error, in words a host understands, when the link fails.
 */
export async function readFeed(
  url: string,
  window: ParseWindow,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<FeedEvent[]> {
  return parseFeed(await fetchCalendarText(url, timeoutMs), window);
}

/** The file a room's calendar link serves: its taken nights, each one only "Not available". */
export function buildRoomCalendarFile(calendarName: string, events: readonly ExportEvent[]): string {
  return buildExportFeed(calendarName, events);
}

/** How many links the admin's health page lists at most: the newest problems first. */
const HEALTH_SHOWN = 100;

/** Calendar sync across the platform, for the admin: how many links, how many need a look, and the newest of those. */
export async function getSyncHealth(actor: PlatformActor, now = new Date()) {
  requirePlatformAdmin(actor);
  const staleBefore = new Date(now.getTime() - FEED_STALE_AFTER_MS);
  const [total, problems, needsLook] = await Promise.all([
    feeds.countLiveFeeds(prisma),
    feeds.countFeedsNeedingLook(prisma, staleBefore),
    feeds.listFeedsNeedingLook(prisma, staleBefore, HEALTH_SHOWN),
  ]);
  return { total, problems, needsLook };
}
