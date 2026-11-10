import { randomUUID } from "node:crypto";
import type { BookingMode, PriceUnit } from "@prisma/client";
import { addRoom, createPlace, createUser, prisma } from "@tests/integration/helpers";
import type { DateRange } from "@/utils/dates";

// A place ready to take bookings, in the mode a test needs, with one room and one signed-up guest. Every call makes
// new rows, so tests never share nights.

export async function placeWithRoom(mode: BookingMode = "OFFLINE", room: Parameters<typeof addRoom>[1] = {}) {
  const place = await createPlace();
  await prisma.business.update({
    where: { id: place.business.id },
    // The online modes need the owner to have accepted full refunds first.
    data: { bookingMode: mode, onlineTermsAcceptedAt: mode === "OFFLINE" ? null : new Date() },
  });
  const unit = await addRoom(place.business.id, room);
  const guest = await createUser("Maya Haddad");
  return { ...place, room: unit, guest };
}

type Place = Awaited<ReturnType<typeof placeWithRoom>>;

/** A guest's request for the place's room on these nights. */
export function requestFor(
  place: Place,
  range: DateRange,
  extra: Partial<{ guestCount: number; guestUserId: string; roomId: string; locale: string }> = {},
) {
  return {
    businessSlug: place.business.slug,
    roomId: place.room.id,
    range,
    guestCount: 2,
    guestName: "Maya Haddad",
    guestPhone: "+96171123456",
    guestEmail: null,
    guestNote: null,
    guestUserId: place.guest.id,
    ...extra,
  };
}

/** A platform stay (Airbnb) on a room's nights, as calendar sync writes it. */
export function importStay(place: { business: { id: string } }, roomId: string, range: DateRange) {
  return prisma.occupancy.create({
    data: {
      businessId: place.business.id,
      roomId,
      kind: "IMPORTED",
      ...range,
      externalUid: crypto.randomUUID(),
    },
  });
}

/**
 * A place in the mode a test needs, selling one experience with one session (by default in 10 days, 8 seats, 25.00 a
 * person), and one signed-up guest.
 */
export async function placeWithSession(
  mode: BookingMode = "OFFLINE",
  options: Partial<{
    capacity: number;
    maxGuests: number;
    priceCents: number;
    priceUnit: PriceUnit;
    startsAt: Date;
  }> = {},
) {
  const place = await createPlace();
  await prisma.business.update({
    where: { id: place.business.id },
    data: { bookingMode: mode, onlineTermsAcceptedAt: mode === "OFFLINE" ? null : new Date() },
  });
  const offering = await prisma.offering.create({
    data: {
      businessId: place.business.id,
      kind: "EXPERIENCE",
      slug: `wine-tasting-${randomUUID()}`,
      title: "Wine tasting in the Bekaa",
      durationMinutes: 120,
      priceCents: options.priceCents ?? 2_500,
      priceUnit: options.priceUnit ?? "PER_PERSON",
      maxGuests: options.maxGuests ?? 6,
    },
  });
  const startsAt = options.startsAt ?? new Date(Date.now() + 10 * 24 * 3_600_000);
  const session = await prisma.offeringSession.create({
    data: {
      businessId: place.business.id,
      offeringId: offering.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * 3_600_000),
      capacity: options.capacity ?? 8,
    },
  });
  const guest = await createUser("Maya Haddad");
  return { ...place, offering, session, guest };
}

type SessionPlace = Awaited<ReturnType<typeof placeWithSession>>;

/** A guest's request for seats in the place's session. */
export function seatsFor(
  place: SessionPlace,
  seats: number,
  extra: Partial<{ guestUserId: string; sessionId: string }> = {},
) {
  return {
    offeringSlug: place.offering.slug,
    sessionId: place.session.id,
    seats,
    guestName: "Maya Haddad",
    guestPhone: "+96171123456",
    guestEmail: null,
    guestNote: null,
    guestUserId: place.guest.id,
    ...extra,
  };
}
