import type { FeedSource } from "@prisma/client";
import { recordAction } from "@/modules/audit/server";
import {
  buildRoomCalendarFile,
  deleteFeedLink,
  findFeed,
  listFeedsDue,
  listRoomFeeds,
  readFeed,
  saveFeedLink,
  saveFeedResult,
} from "@/modules/calendar-sync/server";
import { findRoomByExportToken, hasWholePlaceUnit, listRoomCalendarLinks } from "@/modules/rooms/server";
import { findPlaceForCalendar } from "@/modules/workspaces/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { env } from "@/server/env";
import { AppError, notFound } from "@/server/errors";
import { addDays, todayUtc } from "@/utils/dates";
import * as bookings from "./booking-repository";
import { announceClashes, flagClashes } from "./import-clashes";

// Calendar sync, the booking engine's side. Airbnb and Booking.com refresh what they read from us only every few
// hours, so most double bookings are stopped here, by reading them as often and as late as we can:
//   - every link is read every 10 minutes by the worker (`syncDueFeeds`),
//   - just before a guest's booking takes the nights, the room's links are read again unless read in the last two
//     minutes (`refreshBeforeBooking`), so a platform stay made a moment ago refuses the request,
//   - just before an owner confirms, they are always read again (`refreshBeforeConfirming`),
//   - and the host can press "Sync now".
// Our own link shows a hold the moment it is made, so the platforms stop selling those nights at their next read.
// Whatever still slips through is kept and flagged as a clash, never cancelled (import-clashes.ts).

/** Stays further ahead than a guest can book are not read in. */
const IMPORT_HORIZON_DAYS = 540;
/** The worker reads a link again once its last read is this old. */
const SYNC_INTERVAL_MS = 10 * 60_000;
/** At most this many links per worker run, and this many downloads at once. */
const SYNC_BATCH_SIZE = 60;
const SYNC_AT_ONCE = 6;
/** A guest waiting on their booking: a link read this recently is fresh enough, and one read waits at most this. */
const FRESH_FOR_GUEST_MS = 2 * 60_000;
const GUEST_TIMEOUT_MS = 4_000;

const FEED = "Calendar link";

export interface SyncResult {
  ok: boolean;
  /** This link's stays that clash with our nights after the read. */
  clashes: number;
  /** In words a host understands, when the link failed. */
  error?: string;
}

/**
 * Reads one link and mirrors it into the room's IMPORTED night rows under the room lock. Nothing is ever cancelled:
 * a platform stay over our nights is kept and flagged, and the hosts are told once, when the clash appears. A link
 * that fails changes nothing already read in, and saves its error for the host to see.
 */
async function syncFeed(
  businessId: string,
  feedId: string,
  now: Date,
  timeoutMs?: number,
): Promise<SyncResult> {
  const [feed, place] = await Promise.all([findFeed(businessId, feedId), findPlaceForCalendar(businessId)]);
  if (!feed || !place) throw notFound(FEED);
  try {
    const today = todayUtc(now);
    const stays = await readFeed(
      feed.url,
      { from: today, to: addDays(today, IMPORT_HORIZON_DAYS), timezone: place.timezone },
      timeoutMs,
    );
    const { changes, clashes } = await runInTransaction(async (tx) => {
      // A room switched off keeps its nights; a deleted one has nothing left to block.
      if (!(await bookings.lockActiveRoom(tx, businessId, feed.roomId))) return { changes: [], clashes: 0 };
      await bookings.replaceImportedStays(tx, feed, stays);
      return {
        changes: await flagClashes(tx, businessId, feed.roomId, now),
        clashes: await bookings.countFeedClashes(tx, businessId, feed.id),
      };
    });
    announceClashes(changes, now);
    await saveFeedResult(feed.id, { lastSyncedAt: now, lastError: null });
    return { ok: true, clashes };
  } catch (error) {
    // Only our own errors are worded for the host; anything else is logged and summed up.
    if (!(error instanceof AppError)) console.error("[calendar-sync] reading a calendar link failed", error);
    const message = error instanceof AppError ? error.message : "The calendar could not be read";
    await saveFeedResult(feed.id, { lastSyncedAt: now, lastError: message });
    return { ok: false, clashes: 0, error: message };
  }
}

/** Reads links a few at a time, so a slow platform never holds up the rest for long. */
async function syncEach(
  feeds: ReadonlyArray<{ id: string; businessId: string }>,
  now: Date,
  timeoutMs?: number,
) {
  const results: SyncResult[] = [];
  for (let start = 0; start < feeds.length; start += SYNC_AT_ONCE) {
    const group = feeds.slice(start, start + SYNC_AT_ONCE);
    results.push(
      ...(await Promise.all(group.map((feed) => syncFeed(feed.businessId, feed.id, now, timeoutMs)))),
    );
  }
  return results;
}

/**
 * The links whose stays decide whether a unit is free: its own and, at a place that also books whole, those of the
 * units it takes turns with (every unit, as such places are small).
 */
async function feedsForUnit(businessId: string, roomId: string) {
  const acrossUnits = await hasWholePlaceUnit(businessId);
  return listRoomFeeds(businessId, acrossUnits ? undefined : [roomId]);
}

/**
 * Just before a guest's booking takes the nights: reads the unit's links again unless they were read in the last
 * two minutes, so a stay booked on Airbnb a moment ago refuses this request instead of becoming a clash. The guest
 * waits a few seconds at most, and a link that fails keeps what it read last.
 */
export async function refreshBeforeBooking(businessId: string, roomId: string, now: Date) {
  const freshSince = new Date(now.getTime() - FRESH_FOR_GUEST_MS);
  const stale = (await feedsForUnit(businessId, roomId)).filter(
    (feed) => !feed.lastSyncedAt || feed.lastSyncedAt < freshSince,
  );
  await syncEach(stale, now, GUEST_TIMEOUT_MS);
}

/** Just before an owner confirms: every link of the unit is read again, whenever it was read last. */
export async function refreshBeforeConfirming(businessId: string, roomId: string, now: Date) {
  await syncEach(await feedsForUnit(businessId, roomId), now);
}

// ---------- The calendar links page ----------

/** The address Airbnb and Booking.com read a room from. It ends in .ics, as some platforms ask. */
const calendarLinkUrl = (exportToken: string) =>
  new URL(`/api/ical/${exportToken}.ics`, env.BETTER_AUTH_URL).toString();

/** Each room with its own calendar link and the platform links it reads, oldest first. */
export async function getCalendarLinks(ctx: TenantContext) {
  requirePermission(ctx, "feeds.manage");
  const [rooms, feeds] = await Promise.all([
    listRoomCalendarLinks(ctx.businessId),
    listRoomFeeds(ctx.businessId),
  ]);
  return rooms.map(({ exportToken, ...room }) => ({
    ...room,
    exportUrl: calendarLinkUrl(exportToken),
    feeds: feeds.filter((feed) => feed.roomId === room.id),
  }));
}

/** Connects a room to a platform's calendar link and reads it at once, so the host sees right away if it works. */
export async function connectFeed(
  ctx: TenantContext,
  input: { roomId: string; url: string; source: FeedSource },
  now = new Date(),
) {
  requirePermission(ctx, "feeds.manage");
  const rooms = await listRoomCalendarLinks(ctx.businessId);
  if (!rooms.some((room) => room.id === input.roomId)) throw notFound("Room");
  const feed = await saveFeedLink({ ...input, businessId: ctx.businessId });
  await recordAction(ctx, "feed.added", "feed", feed.id);
  return { feed, sync: await syncFeed(ctx.businessId, feed.id, now) };
}

/** Disconnects a link: the nights it brought are free again, and its clashes are gone. */
export async function disconnectFeed(ctx: TenantContext, feedId: string) {
  requirePermission(ctx, "feeds.manage");
  const feed = await findFeed(ctx.businessId, feedId);
  if (!feed) throw notFound(FEED);
  await runInTransaction(async (tx) => {
    await bookings.lockActiveRoom(tx, ctx.businessId, feed.roomId);
    if (!(await deleteFeedLink(tx, ctx.businessId, feedId))) throw notFound(FEED);
    await bookings.removeFeedStays(tx, ctx.businessId, feedId);
    await recordAction(ctx, "feed.removed", "feed", feedId, tx);
  });
}

/** "Sync now". */
export async function syncFeedNow(ctx: TenantContext, feedId: string, now = new Date()) {
  requirePermission(ctx, "feeds.manage");
  return syncFeed(ctx.businessId, feedId, now);
}

// ---------- The worker, and our own link ----------

/** The worker's run: links not read in 10 minutes, the longest waiting first. */
export async function syncDueFeeds(now = new Date()) {
  const due = await listFeedsDue(new Date(now.getTime() - SYNC_INTERVAL_MS), SYNC_BATCH_SIZE);
  const results = await syncEach(due, now);
  return {
    synced: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
  };
}

/**
 * The .ics a room's calendar link serves, for Airbnb and Booking.com to read. No sign-in: the link's secret is the
 * key, and the file says only which nights are taken. An unknown link is 404.
 */
export async function buildRoomCalendar(exportToken: string, now = new Date()): Promise<string> {
  const room = await findRoomByExportToken(exportToken);
  if (!room) throw notFound("Calendar");
  const [place, acrossUnits] = await Promise.all([
    findPlaceForCalendar(room.businessId),
    hasWholePlaceUnit(room.businessId),
  ]);
  if (!place) throw notFound("Calendar");
  const nights = await bookings.listExportNights(prisma, room, todayUtc(now), now, acrossUnits);
  return buildRoomCalendarFile(`${place.name} · ${room.name}`, nights);
}
