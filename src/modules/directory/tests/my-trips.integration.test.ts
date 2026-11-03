import { describe, expect, it } from "vitest";
import * as myBookings from "@/app/api/me/bookings/route";
import { addRoom, createPlace, stay } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { cancelStayAsGuest, requestBooking } from "@/modules/bookings/server";
import { toIsoDate } from "@/utils/dates";
import { listMyTrips } from "../server";

// The guest's trips list on the real database: their own stays, newest first, and only what the list needs.

async function book(
  guest: { userId: string },
  daysAhead: number,
  room?: Awaited<ReturnType<typeof addRoom>>,
) {
  const place = await createPlace();
  const unit = room ?? (await addRoom(place.business.id, { capacity: 3 }));
  const range = stay(daysAhead, 2);
  const booking = await requestBooking({
    businessSlug: place.business.slug,
    roomId: unit.id,
    range,
    guestCount: 2,
    guestName: "Maya Haddad",
    guestPhone: "+96171123456",
    guestEmail: "maya@example.test",
    guestNote: "Private note",
    guestUserId: guest.userId,
  });
  return { place, unit, booking, range };
}

describe("a guest's trips", () => {
  it("lists their stays newest first, with the place and the room, as dates and whole cents", async () => {
    const guest = await signUp("Maya");
    const first = await book(guest, 10);
    const second = await book(guest, 30);
    const trips = await listMyTrips(guest.userId);
    expect(trips.map((trip) => trip.publicToken)).toEqual([
      second.booking.publicToken,
      first.booking.publicToken,
    ]);
    expect(trips[1]).toEqual({
      publicToken: first.booking.publicToken,
      reference: first.booking.reference,
      status: "HELD",
      bookingMode: "OFFLINE",
      checkIn: toIsoDate(first.range.checkIn),
      checkOut: toIsoDate(first.range.checkOut),
      guestCount: 2,
      totalCents: 18_000,
      currency: "USD",
      place: { name: first.place.business.name, slug: first.place.business.slug },
      roomName: first.unit.name,
    });
  });

  it("never lists someone else's stay", async () => {
    const guest = await signUp("Maya");
    const other = await signUp("Other");
    await book(other, 10);
    expect(await listMyTrips(guest.userId)).toEqual([]);
  });

  it("keeps a cancelled stay in the list, marked as cancelled", async () => {
    const guest = await signUp("Maya");
    const { booking } = await book(guest, 10);
    await cancelStayAsGuest(booking.publicToken, guest.userId, null);
    expect((await listMyTrips(guest.userId)).map((trip) => trip.status)).toEqual(["CANCELLED"]);
  });
});

describe("GET /api/me/bookings", () => {
  it("answers the signed-in guest with their own stays, and nothing private", async () => {
    const guest = await signUp("Maya");
    await book(guest, 10);
    await book(await signUp("Other"), 10);
    const response = await call(myBookings.GET, { as: guest });
    expect(response.status).toBe(200);
    const trips = response.body as Record<string, unknown>[];
    expect(trips).toHaveLength(1);
    const text = JSON.stringify(trips);
    for (const secret of [
      "guestPhone",
      "+96171123456",
      "maya@example.test",
      "Private note",
      "guestUserId",
      "decidedBy",
      "holdExpiresAt",
    ]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it("gives a guest with no stays an empty list", async () => {
    const response = await call(myBookings.GET, { as: await signUp("New") });
    expect(response).toEqual({ status: 200, body: [] });
  });

  it("asks a signed-out visitor to sign in", async () => {
    expect((await call(myBookings.GET)).status).toBe(401);
  });
});
