import { describe, expect, it } from "vitest";
import { memberWith, prisma, stay } from "@tests/integration/helpers";
import { addDays } from "@/utils/dates";
import {
  addBlock,
  cancelBooking,
  confirmBooking,
  getCalendar,
  getCalendarBoard,
  removeBlock,
  reopenNights,
  requestBooking,
} from "../server";
import { importStay, placeWithRoom, requestFor } from "./fixtures";

// Closed dates share the bookings' overlap rule and room lock, and every change to our own nights re-checks the
// room's platform stays at once.

const block = (roomId: string, range: ReturnType<typeof stay>, note: string | null = null) => ({
  roomId,
  range,
  note,
});

describe("closing dates by hand", () => {
  it("closes nights that guests then cannot book, and reopens them", async () => {
    const place = await placeWithRoom();
    const range = stay(10, 3);
    const closed = await addBlock(place.ctx, block(place.room.id, range, "Painting"));
    expect(closed).toMatchObject({ roomId: place.room.id, note: "Painting" });
    expect(await prisma.auditLog.count({ where: { entityId: closed.id, action: "block.added" } })).toBe(1);
    await expect(requestBooking(requestFor(place, stay(11, 1)))).rejects.toMatchObject({ code: "CONFLICT" });

    await removeBlock(place.ctx, closed.id);
    expect(await prisma.auditLog.count({ where: { entityId: closed.id, action: "block.removed" } })).toBe(1);
    await expect(requestBooking(requestFor(place, stay(11, 1)))).resolves.toMatchObject({ status: "HELD" });
    await expect(removeBlock(place.ctx, closed.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to close nights already booked, past nights and another place's room", async () => {
    const place = await placeWithRoom();
    await requestBooking(requestFor(place, stay(10, 2)));
    await expect(addBlock(place.ctx, block(place.room.id, stay(11, 2)))).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Those nights are already booked or closed.",
    });
    await expect(addBlock(place.ctx, block(place.room.id, stay(-5, 2)))).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const other = await placeWithRoom();
    await expect(addBlock(place.ctx, block(other.room.id, stay(10, 2)))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("needs blocks.manage to change the calendar and calendar.read to see it", async () => {
    const place = await placeWithRoom();
    const reader = await memberWith(place.business.id, ["calendar.read"]);
    await expect(addBlock(reader, block(place.room.id, stay(10, 2)))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const outsider = await memberWith(place.business.id, ["bookings.read"]);
    await expect(getCalendar(outsider, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getCalendar(reader, {})).resolves.toEqual([]);
  });

  it("gives the calendar screen the rooms by name to anyone who may read the calendar", async () => {
    const place = await placeWithRoom();
    const off = await prisma.room.create({
      data: {
        businessId: place.business.id,
        name: "Old annex",
        baseRateCents: 5_000,
        exportToken: crypto.randomUUID(),
        active: false,
      },
    });
    const gone = await prisma.room.create({
      data: {
        businessId: place.business.id,
        name: "Gone",
        baseRateCents: 5_000,
        exportToken: crypto.randomUUID(),
        isDeleted: true,
      },
    });
    const range = stay(10, 2);
    await addBlock(place.ctx, block(place.room.id, range));

    const reader = await memberWith(place.business.id, ["calendar.read"]);
    const board = await getCalendarBoard(reader, {});
    expect(board.rooms.map((room) => room.id)).toEqual([place.room.id, off.id]);
    expect(board.rooms.map((room) => room.id)).not.toContain(gone.id);
    expect(board.occupancy.map((night) => night.kind)).toEqual(["MANUAL"]);

    const outsider = await memberWith(place.business.id, ["rooms.read"]);
    await expect(getCalendarBoard(outsider, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("shows every source of taken nights in one calendar, six weeks by default", async () => {
    const place = await placeWithRoom();
    const booking = await requestBooking(requestFor(place, stay(5, 2)));
    await addBlock(place.ctx, block(place.room.id, stay(8, 1)));
    await importStay(place, place.room.id, stay(12, 2));
    await addBlock(place.ctx, block(place.room.id, stay(60, 1)));

    const nights = await getCalendar(place.ctx, {});
    expect(nights.map((night) => night.kind)).toEqual(["DIRECT", "MANUAL", "IMPORTED"]);
    expect(nights[0]?.booking).toMatchObject({ id: booking.id, status: "HELD" });
    const later = await getCalendar(place.ctx, { from: stay(50, 1).checkIn, to: stay(70, 1).checkIn });
    expect(later.map((night) => night.kind)).toEqual(["MANUAL"]);
    const today = stay(0, 1).checkIn;
    await expect(getCalendar(place.ctx, { from: today, to: addDays(today, 401) })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("reopening some closed nights", () => {
  /** The room's closed dates as they stand, each with its note. */
  const closedNights = async (roomId: string) =>
    (
      await prisma.occupancy.findMany({
        where: { roomId, kind: "MANUAL", active: true, isDeleted: false },
        orderBy: { checkIn: "asc" },
      })
    ).map(({ checkIn, checkOut, note }) => ({ checkIn, checkOut, note }));

  it("reopens a whole closed block", async () => {
    const place = await placeWithRoom();
    const closed = await addBlock(place.ctx, block(place.room.id, stay(10, 3), "Painting"));
    expect(await reopenNights(place.ctx, place.room.id, stay(10, 3))).toEqual({
      reopened: [stay(10, 3)],
      leftClosed: [],
    });
    expect(await closedNights(place.room.id)).toEqual([]);
    // Kept inactive, never deleted.
    expect((await prisma.occupancy.findUniqueOrThrow({ where: { id: closed.id } })).active).toBe(false);
    expect(await prisma.auditLog.count({ where: { entityId: closed.id, action: "block.removed" } })).toBe(1);
  });

  it("trims the end: closed the 12th to the 14th, the 14th reopened, the 12th and 13th stay closed", async () => {
    const place = await placeWithRoom();
    await addBlock(place.ctx, block(place.room.id, stay(12, 3), "Painting"));
    expect(await reopenNights(place.ctx, place.room.id, stay(14, 1))).toEqual({
      reopened: [stay(14, 1)],
      leftClosed: [stay(12, 2)],
    });
    expect(await closedNights(place.room.id)).toEqual([{ ...stay(12, 2), note: "Painting" }]);
    await expect(requestBooking(requestFor(place, stay(14, 1)))).resolves.toMatchObject({ status: "HELD" });
    await expect(requestBooking(requestFor(place, stay(13, 1)))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("trims the start", async () => {
    const place = await placeWithRoom();
    await addBlock(place.ctx, block(place.room.id, stay(12, 3), "Painting"));
    expect(await reopenNights(place.ctx, place.room.id, stay(12, 1))).toEqual({
      reopened: [stay(12, 1)],
      leftClosed: [stay(13, 2)],
    });
    expect(await closedNights(place.room.id)).toEqual([{ ...stay(13, 2), note: "Painting" }]);
  });

  it("splits a block reopened in the middle into one on each side", async () => {
    const place = await placeWithRoom();
    const closed = await addBlock(place.ctx, block(place.room.id, stay(10, 5), "Family visit"));
    expect(await reopenNights(place.ctx, place.room.id, stay(12, 1))).toEqual({
      reopened: [stay(12, 1)],
      leftClosed: [stay(10, 2), stay(13, 2)],
    });
    expect(await closedNights(place.room.id)).toEqual([
      { ...stay(10, 2), note: "Family visit" },
      { ...stay(13, 2), note: "Family visit" },
    ]);
    expect(await prisma.auditLog.count({ where: { entityId: closed.id, action: "block.removed" } })).toBe(1);
  });

  it("reopens across several blocks, and never touches a booking or a platform stay", async () => {
    const place = await placeWithRoom();
    await addBlock(place.ctx, block(place.room.id, stay(10, 2)));
    const booking = await requestBooking(requestFor(place, stay(12, 2)));
    const imported = await importStay(place, place.room.id, stay(14, 2));
    await addBlock(place.ctx, block(place.room.id, stay(16, 3)));

    expect(await reopenNights(place.ctx, place.room.id, stay(11, 6))).toEqual({
      reopened: [stay(11, 1), stay(16, 1)],
      leftClosed: [stay(10, 1), stay(17, 2)],
    });
    const kept = await prisma.occupancy.findMany({
      where: { roomId: place.room.id, active: true, kind: { not: "MANUAL" } },
      orderBy: { checkIn: "asc" },
    });
    expect(kept.map((night) => [night.kind, night.checkIn])).toEqual([
      ["DIRECT", stay(12, 2).checkIn],
      ["IMPORTED", imported.checkIn],
    ]);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: "HELD",
    });
  });

  it("does nothing on open nights, and refuses backwards dates and members who may not close", async () => {
    const place = await placeWithRoom();
    expect(await reopenNights(place.ctx, place.room.id, stay(10, 2))).toEqual({
      reopened: [],
      leftClosed: [],
    });
    const backwards = { checkIn: stay(12, 1).checkIn, checkOut: stay(10, 1).checkIn };
    await expect(reopenNights(place.ctx, place.room.id, backwards)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const reader = await memberWith(place.business.id, ["calendar.read"]);
    await expect(reopenNights(reader, place.room.id, stay(10, 2))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("leaves another place's closed dates alone", async () => {
    const place = await placeWithRoom();
    const other = await placeWithRoom();
    await addBlock(other.ctx, block(other.room.id, stay(10, 2)));
    expect(await reopenNights(place.ctx, other.room.id, stay(10, 2))).toEqual({
      reopened: [],
      leftClosed: [],
    });
    expect(await closedNights(other.room.id)).toHaveLength(1);
  });
});

describe("platform stays that clash with ours", () => {
  const flagOf = async (id: string) => (await prisma.occupancy.findUniqueOrThrow({ where: { id } })).conflict;

  it("flags a clash at once when we close nights over a platform stay, and clears it when we reopen them", async () => {
    const place = await placeWithRoom();
    const imported = await importStay(place, place.room.id, stay(10, 3));
    const closed = await addBlock(place.ctx, block(place.room.id, stay(11, 1)));
    expect(await flagOf(imported.id)).toBe(true);
    // Kept, never cancelled: it is a real guest, and its nights stay blocked.
    expect((await prisma.occupancy.findUniqueOrThrow({ where: { id: imported.id } })).active).toBe(true);
    expect(
      await prisma.auditLog.count({ where: { entityId: imported.id, action: "calendar.conflict" } }),
    ).toBe(1);

    await removeBlock(place.ctx, closed.id);
    expect(await flagOf(imported.id)).toBe(false);
    expect(
      await prisma.auditLog.count({ where: { entityId: imported.id, action: "calendar.conflict_resolved" } }),
    ).toBe(1);
  });

  it("clears a clash as soon as the owner cancels the booking under it", async () => {
    const place = await placeWithRoom();
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    await confirmBooking(place.ctx, { bookingId: booking.id });
    // Airbnb refreshed late and sent a stay over nights we had already sold.
    const imported = await importStay(place, place.room.id, stay(10, 2));
    await addBlock(place.ctx, block(place.room.id, stay(20, 1)));
    expect(await flagOf(imported.id)).toBe(true);

    await cancelBooking(place.ctx, { bookingId: booking.id });
    expect(await flagOf(imported.id)).toBe(false);
  });
});
