import type { BookingMode } from "@prisma/client";
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
