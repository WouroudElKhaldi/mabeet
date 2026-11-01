import { describe, expect, it } from "vitest";
import { createUser, prisma, stay } from "@tests/integration/helpers";
import { addDays } from "@/utils/dates";
import { cancelStayAsGuest, confirmBooking, getBookingForGuest, requestBooking } from "../server";
import { placeWithRoom, requestFor } from "./fixtures";

// A signed-in guest cancels their own booking from its private link, without calling the host.

describe("the guest cancels", () => {
  it("cancels before check-in from the private link, freeing the nights", async () => {
    const place = await placeWithRoom();
    const range = stay(10, 2);
    const booking = await requestBooking(requestFor(place, range));
    await confirmBooking(place.ctx, { bookingId: booking.id });

    const cancelled = await cancelStayAsGuest(booking.publicToken, place.guest.id, "Plans changed");
    expect(cancelled).toMatchObject({ status: "CANCELLED", cancelReason: "Plans changed" });
    expect(await prisma.occupancy.findUniqueOrThrow({ where: { bookingId: booking.id } })).toMatchObject({
      active: false,
    });
    expect(
      await prisma.auditLog.count({
        where: {
          businessId: place.business.id,
          action: "booking.cancelled_by_guest",
          actorId: place.guest.id,
        },
      }),
    ).toBe(1);
    await expect(requestBooking(requestFor(place, range))).resolves.toMatchObject({ status: "HELD" });
  });

  it("opens a booking's link only for the guest who made it", async () => {
    const place = await placeWithRoom();
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    const someoneElse = await createUser("Karim");
    expect(await getBookingForGuest(booking.publicToken, someoneElse.id)).toBeNull();
    expect(await cancelStayAsGuest(booking.publicToken, someoneElse.id, null)).toBeNull();
    expect(await cancelStayAsGuest("no-such-link-at-all-anywhere", place.guest.id, null)).toBeNull();
    const own = await getBookingForGuest(booking.publicToken, place.guest.id);
    expect(own).toMatchObject({
      id: booking.id,
      status: "HELD",
      room: { name: place.room.name },
      payments: [],
    });
    // Only what a guest may see of the place.
    expect(own?.business).not.toHaveProperty("commissionRateBps");
    expect(own?.business).not.toHaveProperty("stripeCustomerId");
  });

  it("cannot cancel once the stay has started, nor cancel twice", async () => {
    const place = await placeWithRoom();
    const range = stay(10, 3);
    const booking = await requestBooking(requestFor(place, range));
    await expect(
      cancelStayAsGuest(booking.publicToken, place.guest.id, null, addDays(range.checkIn, 1)),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This stay has already started, so it can no longer be cancelled.",
    });

    await cancelStayAsGuest(booking.publicToken, place.guest.id, null);
    await expect(cancelStayAsGuest(booking.publicToken, place.guest.id, null)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
