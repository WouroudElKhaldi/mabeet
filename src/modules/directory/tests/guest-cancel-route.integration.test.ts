import { beforeEach, describe, expect, it } from "vitest";
import * as cancelRoute from "@/app/api/public/bookings/[token]/cancel/route";
import { addRoom, createPlace, prisma, stay } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { requestBooking } from "@/modules/bookings/server";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";

// The guest cancels from their booking page: only their own booking, only before check-in, and the nights open again.

async function bookedStay(daysAhead = 10) {
  const place = await createPlace();
  const room = await addRoom(place.business.id, { capacity: 3 });
  const guest = await signUp("Maya");
  const booking = await requestBooking({
    businessSlug: place.business.slug,
    roomId: room.id,
    range: stay(daysAhead, 2),
    guestCount: 2,
    guestName: "Maya Haddad",
    guestPhone: "+96171123456",
    guestEmail: null,
    guestNote: null,
    guestUserId: guest.userId,
  });
  return { place, room, guest, booking };
}

describe("POST /api/public/bookings/{token}/cancel", () => {
  beforeEach(resetMemoryRateLimits);

  it("cancels the guest's own booking, keeps their reason, and opens the nights again", async () => {
    const { guest, booking } = await bookedStay();
    const response = await call(cancelRoute.POST, {
      as: guest,
      params: { token: booking.publicToken },
      body: { reason: "Plans changed" },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "CANCELLED" });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: "CANCELLED",
      cancelReason: "Plans changed",
    });
    expect(await prisma.occupancy.count({ where: { bookingId: booking.id, active: true } })).toBe(0);
  });

  it("works without a reason", async () => {
    const { guest, booking } = await bookedStay();
    const response = await call(cancelRoute.POST, {
      as: guest,
      params: { token: booking.publicToken },
      body: {},
    });
    expect(response.status).toBe(200);
  });

  it("treats someone else's booking as not found, and leaves it alone", async () => {
    const { booking } = await bookedStay();
    const stranger = await signUp("Stranger");
    const response = await call(cancelRoute.POST, {
      as: stranger,
      params: { token: booking.publicToken },
      body: {},
    });
    expect(response.status).toBe(404);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).not.toBe(
      "CANCELLED",
    );
  });

  it("asks a signed-out visitor to sign in, and an unknown or malformed link is not found or refused", async () => {
    const { guest, booking } = await bookedStay();
    expect((await call(cancelRoute.POST, { params: { token: booking.publicToken }, body: {} })).status).toBe(
      401,
    );
    expect(
      (await call(cancelRoute.POST, { as: guest, params: { token: "x".repeat(30) }, body: {} })).status,
    ).toBe(404);
    expect((await call(cancelRoute.POST, { as: guest, params: { token: "short" }, body: {} })).status).toBe(
      400,
    );
  });

  it("refuses to cancel twice, with 409", async () => {
    const { guest, booking } = await bookedStay();
    const options = { as: guest, params: { token: booking.publicToken }, body: {} };
    expect((await call(cancelRoute.POST, options)).status).toBe(200);
    expect((await call(cancelRoute.POST, options)).status).toBe(409);
  });

  it("refuses once the stay has started, with 409", async () => {
    const { guest, booking } = await bookedStay(0);
    const response = await call(cancelRoute.POST, {
      as: guest,
      params: { token: booking.publicToken },
      body: {},
    });
    expect(response.status).toBe(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("HELD");
  });

  it("refuses a reason that is too long, with 400", async () => {
    const { guest, booking } = await bookedStay();
    const response = await call(cancelRoute.POST, {
      as: guest,
      params: { token: booking.publicToken },
      body: { reason: "x".repeat(301) },
    });
    expect(response.status).toBe(400);
  });

  it("slows a guest who asks too often", async () => {
    const { guest, booking } = await bookedStay();
    let last = 0;
    for (let index = 0; index < 11; index += 1) {
      last = (await call(cancelRoute.POST, { as: guest, params: { token: booking.publicToken }, body: {} }))
        .status;
    }
    expect(last).toBe(429);
  });
});
