import { lookup } from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memberWith, prisma, stay } from "@tests/integration/helpers";
import {
  addBlock,
  buildRoomCalendar,
  cancelBooking,
  confirmBooking,
  connectFeed,
  disconnectFeed,
  getCalendarLinks,
  requestBooking,
  syncDueFeeds,
  syncFeedNow,
} from "../server";
import { placeWithRoom, requestFor } from "./fixtures";
import type { DateRange } from "@/utils/dates";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

// Calendar sync with real data: platform stays in, our nights out, and clashes kept and flagged, never cancelled.
// The platform's calendar is whatever `platform` holds when it is read.

let platform: Array<{ uid: string; range: DateRange }> = [];
let platformDown = false;

const icsDate = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "");
const platformCalendar = () =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...platform.flatMap(({ uid, range }) => [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${icsDate(range.checkIn)}`,
      `DTEND;VALUE=DATE:${icsDate(range.checkOut)}`,
      "SUMMARY:Reserved",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");

const reads = vi.fn(async () =>
  platformDown ? new Response("busy", { status: 503 }) : new Response(platformCalendar()),
);

beforeEach(() => {
  platform = [];
  platformDown = false;
  reads.mockClear();
  vi.mocked(lookup).mockResolvedValue([{ address: "54.230.10.1", family: 4 }] as never);
  vi.stubGlobal("fetch", reads);
});
afterEach(() => vi.unstubAllGlobals());

const airbnbLink = () => `https://www.airbnb.com/calendar/ical/${crypto.randomUUID()}.ics`;

async function connected(mode: Parameters<typeof placeWithRoom>[0] = "OFFLINE") {
  const place = await placeWithRoom(mode);
  const { feed, sync } = await connectFeed(place.ctx, {
    roomId: place.room.id,
    url: airbnbLink(),
    source: "AIRBNB",
  });
  return { ...place, feed, sync };
}

const imported = (feedId: string) =>
  prisma.occupancy.findMany({ where: { feedId, kind: "IMPORTED" }, orderBy: { checkIn: "asc" } });

describe("reading Airbnb and Booking.com", () => {
  it("brings platform stays in as taken nights, once, and frees them when the platform cancels", async () => {
    const place = await connected();
    expect(place.sync).toEqual({ ok: true, clashes: 0 });
    platform = [{ uid: "a1", range: stay(10, 3) }];
    await expect(syncFeedNow(place.ctx, place.feed.id)).resolves.toEqual({ ok: true, clashes: 0 });
    await syncFeedNow(place.ctx, place.feed.id);
    expect(await imported(place.feed.id)).toHaveLength(1);
    await expect(requestBooking(requestFor(place, stay(11, 1)))).rejects.toMatchObject({ code: "CONFLICT" });

    platform = [];
    await syncFeedNow(place.ctx, place.feed.id);
    expect((await imported(place.feed.id)).map((row) => row.active)).toEqual([false]);
    await expect(requestBooking(requestFor(place, stay(11, 1)))).resolves.toMatchObject({ status: "HELD" });
  });

  it("keeps what it read and saves the error when a link fails", async () => {
    const place = await connected();
    platform = [{ uid: "a1", range: stay(10, 2) }];
    await syncFeedNow(place.ctx, place.feed.id);
    platformDown = true;
    await expect(syncFeedNow(place.ctx, place.feed.id)).resolves.toMatchObject({
      ok: false,
      error: "The calendar link answered with status 503",
    });
    expect((await imported(place.feed.id)).map((row) => row.active)).toEqual([true]);
    const [room] = await getCalendarLinks(place.ctx);
    expect(room?.feeds[0]?.lastError).toBe("The calendar link answered with status 503");
  });

  it("keeps a clash, flags it, tells the hosts once, and clears it when our booking is cancelled", async () => {
    const place = await connected();
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    platform = [{ uid: "a1", range: stay(11, 2) }];
    await expect(syncFeedNow(place.ctx, place.feed.id)).resolves.toEqual({ ok: true, clashes: 1 });
    await syncFeedNow(place.ctx, place.feed.id);
    const [clash] = await imported(place.feed.id);
    expect(clash).toMatchObject({ active: true, conflict: true });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: "HELD",
    });
    expect(await prisma.auditLog.count({ where: { entityId: clash?.id, action: "calendar.conflict" } })).toBe(
      1,
    );

    await cancelBooking(place.ctx, { bookingId: booking.id });
    expect((await imported(place.feed.id))[0]?.conflict).toBe(false);
    expect(
      await prisma.auditLog.count({ where: { entityId: clash?.id, action: "calendar.conflict_resolved" } }),
    ).toBe(1);
  });

  it("flags a clash at once when the host closes dates over platform nights", async () => {
    const place = await connected();
    platform = [{ uid: "a1", range: stay(10, 2) }];
    await syncFeedNow(place.ctx, place.feed.id);
    await addBlock(place.ctx, { roomId: place.room.id, range: stay(11, 1), note: null });
    expect((await imported(place.feed.id))[0]?.conflict).toBe(true);
  });
});

describe("reading the platforms as late as we can", () => {
  it("reads the room's links again before a guest's booking, so a stay sold a moment ago refuses it", async () => {
    const place = await connected();
    // The link was read just now, on connecting: a read this fresh is not repeated for the guest.
    platform = [{ uid: "new", range: stay(20, 2) }];
    await requestBooking(requestFor(place, stay(40, 1)));
    expect(reads).toHaveBeenCalledTimes(1);

    const later = new Date(Date.now() + 3 * 60_000);
    await expect(requestBooking(requestFor(place, stay(20, 1)), later)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it("reads the room's links again before the owner confirms, and refuses nights sold since", async () => {
    const place = await connected();
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    platform = [{ uid: "a1", range: stay(11, 1) }];
    await expect(confirmBooking(place.ctx, { bookingId: booking.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: "HELD",
    });

    platform = [];
    await expect(confirmBooking(place.ctx, { bookingId: booking.id })).resolves.toMatchObject({
      status: "CONFIRMED",
    });
  });

  it("lets the worker read links not read in ten minutes", async () => {
    const place = await connected();
    await prisma.calendarFeed.update({
      where: { id: place.feed.id },
      data: { lastSyncedAt: new Date(Date.now() - 11 * 60_000) },
    });
    platform = [{ uid: "a1", range: stay(10, 2) }];
    const run = await syncDueFeeds();
    expect(run.synced).toBeGreaterThanOrEqual(1);
    expect(await imported(place.feed.id)).toHaveLength(1);
  });
});

describe("managing links", () => {
  it("refuses the same link twice, private addresses, members without feeds.manage and other places", async () => {
    const place = await connected();
    const again = { roomId: place.room.id, url: place.feed.url, source: "AIRBNB" as const };
    await expect(connectFeed(place.ctx, again)).rejects.toMatchObject({ code: "CONFLICT" });
    vi.mocked(lookup).mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as never);
    await expect(
      connectFeed(place.ctx, { roomId: place.room.id, url: airbnbLink(), source: "AIRBNB" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const staff = await memberWith(place.business.id, ["calendar.read", "blocks.manage"]);
    await expect(getCalendarLinks(staff)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncFeedNow(staff, place.feed.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const other = await placeWithRoom();
    await expect(syncFeedNow(other.ctx, place.feed.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("frees a link's nights when it is disconnected", async () => {
    const place = await connected();
    platform = [{ uid: "a1", range: stay(10, 2) }];
    await syncFeedNow(place.ctx, place.feed.id);
    await disconnectFeed(place.ctx, place.feed.id);
    await expect(requestBooking(requestFor(place, stay(10, 2)))).resolves.toMatchObject({ status: "HELD" });
    await expect(disconnectFeed(place.ctx, place.feed.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("our calendar link", () => {
  it("shows our bookings, holds and closed dates from today, never platform stays or guest details", async () => {
    const place = await connected("AUTOMATIC");
    const booking = await requestBooking(requestFor(place, stay(5, 2)));
    const block = await addBlock(place.ctx, { roomId: place.room.id, range: stay(8, 1), note: "Painting" });
    platform = [{ uid: "a1", range: stay(12, 2) }];
    await syncFeedNow(place.ctx, place.feed.id);
    const [room] = await getCalendarLinks(place.ctx);
    const token =
      new URL(room?.exportUrl ?? "").pathname
        .split("/")
        .at(-1)
        ?.replace(/\.ics$/, "") ?? "";

    const file = await buildRoomCalendar(token);
    expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(file).toContain(`UID:${block.id}@mabeet`);
    // The guest's hold, still waiting for its payment, is already taken on the platforms.
    const night = await prisma.occupancy.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect(file).toContain(`UID:${night.id}@mabeet`);
    for (const secret of ["Maya", "Painting", "+961", booking.reference]) expect(file).not.toContain(secret);
    await expect(buildRoomCalendar("x".repeat(43))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
