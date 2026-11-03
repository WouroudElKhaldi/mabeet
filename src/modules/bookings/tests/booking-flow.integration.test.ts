import { describe, expect, it } from "vitest";
import { addRoom, createPlace, memberWith, prisma, stay } from "@tests/integration/helpers";
import { runHousekeeping } from "@/modules/housekeeping/server";
import { addDays } from "@/utils/dates";
import {
  cancelBooking,
  confirmBooking,
  declineBooking,
  getBooking,
  listBookings,
  listMyBookings,
  requestBooking,
} from "../server";
import { importStay, placeWithRoom, requestFor } from "./fixtures";

// The booking engine on the real database: a request holds the room at once, and what happens next follows the
// place's mode. Tests pass `now`, so the clock is theirs.

const HOUR_MS = 3_600_000;

describe("asking for a stay", () => {
  it("holds the room for the owner's answer offline, priced night by night", async () => {
    const place = await placeWithRoom("OFFLINE", { baseRateCents: 9_000 });
    const range = stay(10, 3);
    await prisma.rateOverride.create({
      data: {
        businessId: place.business.id,
        roomId: place.room.id,
        date: addDays(range.checkIn, 1),
        rateCents: 15_000,
      },
    });
    const now = new Date();
    const booking = await requestBooking(requestFor(place, range), now);

    expect(booking).toMatchObject({
      status: "HELD",
      bookingMode: "OFFLINE",
      totalCents: 33_000,
      currency: "USD",
      holdExpiresAt: new Date(now.getTime() + 24 * HOUR_MS),
    });
    expect(booking.reference).toMatch(/^[A-Z0-9-]+$/);
    expect(await prisma.occupancy.findUniqueOrThrow({ where: { bookingId: booking.id } })).toMatchObject({
      kind: "DIRECT",
      active: true,
    });
    expect(
      await prisma.activityLog.count({ where: { userId: place.guest.id, action: "booking.requested" } }),
    ).toBe(1);
    expect(await listMyBookings(place.guest.id)).toEqual([
      expect.objectContaining({
        id: booking.id,
        business: { name: place.business.name, slug: place.business.slug },
      }),
    ]);
  });

  it("gives the guest 10 minutes to pay online, and leaves the decision to the payment", async () => {
    for (const mode of ["AUTOMATIC", "ONLINE_APPROVAL"] as const) {
      const place = await placeWithRoom(mode);
      const now = new Date();
      const booking = await requestBooking(requestFor(place, stay(10, 2)), now);
      expect(booking).toMatchObject({
        status: "AWAITING_PAYMENT",
        bookingMode: mode,
        holdExpiresAt: new Date(now.getTime() + 10 * 60_000),
      });
      await expect(confirmBooking(place.ctx, { bookingId: booking.id })).rejects.toMatchObject({
        code: "CONFLICT",
      });
    }
  });

  it("keeps an LBP total past the 32-bit limit exact, and reads it back as a number", async () => {
    const place = await placeWithRoom("OFFLINE", { baseRateCents: 1_500_000_000 });
    await prisma.business.update({ where: { id: place.business.id }, data: { currency: "LBP" } });
    const booking = await requestBooking(requestFor(place, stay(10, 3)));
    expect(booking.totalCents).toBe(4_500_000_000);
    expect((await getBooking(place.ctx, booking.id)).totalCents).toBe(4_500_000_000);
  });

  it("refuses dates in the past, too long or too far ahead, and a room too small or too short a stay", async () => {
    const place = await placeWithRoom("OFFLINE", { capacity: 2, minNights: 2 });
    const refused = (range: ReturnType<typeof stay>, guestCount = 2) =>
      expect(requestBooking(requestFor(place, range, { guestCount }))).rejects.toMatchObject({
        code: "VALIDATION",
      });
    await refused(stay(-1, 2));
    await refused(stay(10, 61));
    await refused(stay(541, 2));
    await refused(stay(10, 2), 3);
    await refused(stay(10, 1));
    expect(await prisma.booking.count({ where: { roomId: place.room.id } })).toBe(0);
  });

  it("refuses an unknown place, a room of another place and a room taken off", async () => {
    const place = await placeWithRoom();
    const other = await placeWithRoom();
    await expect(
      requestBooking({ ...requestFor(place, stay(10, 2)), businessSlug: "no-such-place" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      requestBooking(requestFor(place, stay(10, 2), { roomId: other.room.id })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await prisma.room.update({ where: { id: place.room.id }, data: { active: false } });
    await expect(requestBooking(requestFor(place, stay(10, 2)))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses nights already taken on Airbnb or Booking.com", async () => {
    const place = await placeWithRoom();
    await importStay(place, place.room.id, stay(10, 3));
    await expect(requestBooking(requestFor(place, stay(11, 2)))).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Those dates were just taken. Please pick other dates.",
    });
    await expect(requestBooking(requestFor(place, stay(13, 2)))).resolves.toMatchObject({ status: "HELD" });
  });

  it("keeps a room and the whole place from being booked on the same nights", async () => {
    const place = await placeWithRoom();
    const wholePlace = await addRoom(place.business.id, { kind: "WHOLE_PLACE", capacity: 8 });
    // The place books by room, but the whole place still has a stay running from before the switch.
    await prisma.occupancy.create({
      data: { businessId: place.business.id, roomId: wholePlace.id, kind: "MANUAL", ...stay(10, 4) },
    });
    await expect(requestBooking(requestFor(place, stay(12, 2)))).rejects.toMatchObject({ code: "CONFLICT" });
    // Only the units the place books by can be booked.
    await expect(
      requestBooking(requestFor(place, stay(20, 2), { roomId: wholePlace.id })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(requestBooking(requestFor(place, stay(14, 2)))).resolves.toMatchObject({ status: "HELD" });
  });
});

describe("the owner decides", () => {
  it("confirms a request, saying who decided and when, on the guest's timeline too", async () => {
    const place = await placeWithRoom();
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    const now = new Date();
    const confirmed = await confirmBooking(place.ctx, { bookingId: booking.id }, now);
    expect(confirmed).toMatchObject({ status: "CONFIRMED", decidedById: place.owner.id, decidedAt: now });
    expect(
      await prisma.auditLog.count({
        where: { entityId: booking.id, action: "booking.confirmed", actorId: place.owner.id },
      }),
    ).toBe(1);
    expect(
      await prisma.activityLog.count({ where: { userId: place.guest.id, action: "booking.confirmed" } }),
    ).toBe(1);
    await expect(declineBooking(place.ctx, { bookingId: booking.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("frees the nights when it declines or cancels", async () => {
    const place = await placeWithRoom();
    const range = stay(10, 2);
    const first = await requestBooking(requestFor(place, range));
    await declineBooking(place.ctx, { bookingId: first.id, reason: "Closed for a family event" });
    expect(await prisma.occupancy.findUniqueOrThrow({ where: { bookingId: first.id } })).toMatchObject({
      active: false,
    });
    const second = await requestBooking(requestFor(place, range));
    await confirmBooking(place.ctx, { bookingId: second.id });
    const cancelled = await cancelBooking(place.ctx, { bookingId: second.id, reason: "Water cut" });
    expect(cancelled).toMatchObject({ status: "CANCELLED", cancelReason: "Water cut" });
    await expect(requestBooking(requestFor(place, range))).resolves.toMatchObject({ status: "HELD" });
  });

  it("cannot confirm a request whose time ran out; housekeeping then frees its nights", async () => {
    const place = await placeWithRoom();
    const now = new Date();
    const range = stay(10, 2);
    const booking = await requestBooking(requestFor(place, range), now);
    const later = new Date(now.getTime() + 25 * HOUR_MS);
    await expect(confirmBooking(place.ctx, { bookingId: booking.id }, later)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const result = await runHousekeeping(later);
    expect(result.expired).toBeGreaterThanOrEqual(1);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: "EXPIRED",
    });
    expect(
      await prisma.activityLog.count({ where: { userId: place.guest.id, action: "booking.expired" } }),
    ).toBe(1);
    await expect(requestBooking(requestFor(place, range), later)).resolves.toMatchObject({ status: "HELD" });
  });

  it("frees an unpaid online booking after 10 minutes, even before housekeeping runs", async () => {
    const place = await placeWithRoom("AUTOMATIC");
    const now = new Date();
    const range = stay(10, 2);
    const unpaid = await requestBooking(requestFor(place, range), now);
    const later = new Date(now.getTime() + 11 * 60_000);
    // The next request on the room expires the old hold first.
    await expect(requestBooking(requestFor(place, range), later)).resolves.toMatchObject({
      status: "AWAITING_PAYMENT",
    });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: unpaid.id } })).status).toBe("EXPIRED");
  });

  it("cannot confirm nights a platform took after the request", async () => {
    const place = await placeWithRoom();
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    await importStay(place, place.room.id, stay(11, 3));
    await expect(confirmBooking(place.ctx, { bookingId: booking.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("needs bookings.decide, hides the guest's contact without guests.contact, and never reaches another place", async () => {
    const place = await placeWithRoom();
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    const reader = await memberWith(place.business.id, ["bookings.read"]);
    await expect(confirmBooking(reader, { bookingId: booking.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const [seen] = await listBookings(reader, { take: 50, skip: 0 });
    expect(seen).toMatchObject({ id: booking.id, guestPhone: "+961••••3456" });
    const [full] = await listBookings(place.ctx, { take: 50, skip: 0 });
    expect(full?.guestPhone).toBe("+96171123456");

    const stranger = await createPlace();
    await expect(confirmBooking(stranger.ctx, { bookingId: booking.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(getBooking(stranger.ctx, booking.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists the place's bookings by status, room and dates", async () => {
    const place = await placeWithRoom();
    const early = await requestBooking(requestFor(place, stay(10, 2)));
    const late = await requestBooking(requestFor(place, stay(40, 2)));
    await confirmBooking(place.ctx, { bookingId: late.id });
    const ids = async (filters: Partial<Parameters<typeof listBookings>[1]>) =>
      (await listBookings(place.ctx, { take: 50, skip: 0, ...filters })).map((row) => row.id);
    expect(await ids({})).toEqual([early.id, late.id]);
    expect(await ids({ status: "CONFIRMED" })).toEqual([late.id]);
    expect(await ids({ from: stay(30, 1).checkIn })).toEqual([late.id]);
    expect(await ids({ to: stay(30, 1).checkIn })).toEqual([early.id]);
    expect(await ids({ take: 1, skip: 1 })).toEqual([late.id]);
  });
});
