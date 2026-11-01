import { describe, expect, it } from "vitest";
import { memberWith, prisma, stay } from "@tests/integration/helpers";
import { addDays } from "@/utils/dates";
import { addBlock, cancelBooking, confirmBooking, getCalendar, removeBlock, requestBooking } from "../server";
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
