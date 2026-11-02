import { BOOKABLE_ROOM_KIND, MAX_STAY_NIGHTS } from "@/config/booking-limits";
import { getTakenNights, stayIssue } from "@/modules/bookings/server";
import { findRoomForBooking, listPlacePhotos, listPublicUnits, priceStay } from "@/modules/rooms/server";
import { findBookablePlace, getPublicPlace } from "@/modules/workspaces/server";
import { notFound } from "@/server/errors";
import { countNights, type DateRange } from "@/utils/dates";
import type { PublicPlace, RoomAvailability, RoomQuote } from "../types";

// The public side: what a guest can see and ask before signing in. Nothing here takes or frees nights; the booking
// engine does. Whether a stay can be booked is the engine's own rule (`stayIssue`), so a quote never promises what
// booking would refuse.

/**
 * The price of a stay in a room, and whether it can be booked as asked. A stay that cannot still gets its price
 * (the screen can show both) unless it is too long to price at all.
 */
export async function quoteRoom(
  slug: string,
  roomId: string,
  { range, guests }: { range: DateRange; guests: number | null },
  now: Date = new Date(),
): Promise<RoomQuote> {
  const place = await findBookablePlace(slug);
  if (!place) throw notFound("Place");
  const room = await findRoomForBooking(place.id, roomId);
  // A room the host switched off, or one the place does not book by (a room of a place that books whole), cannot be
  // booked, so it is not priced either: the booking engine refuses both in the same way.
  if (!room?.active || room.kind !== BOOKABLE_ROOM_KIND[place.bookingUnit]) throw notFound("Room");

  const nightCount = countNights(range);
  const issue = stayIssue({ range, guests, room }, now);
  const quote = nightCount > MAX_STAY_NIGHTS ? { nights: [], totalCents: 0 } : await priceStay(room, range);
  return { roomId: room.id, currency: place.currency, nightCount, issue, ...quote };
}

/**
 * A place's page, by its link: what any visitor may see, or null when there is no such place (or it is paused or
 * deleted). It books by its rooms or as a whole; either way `units` is what a guest can book, and a place booked
 * whole also lists its rooms, to show. A place with no photos of its own shows its rooms' photos, so a host who only
 * photographed the rooms still has a gallery.
 */
export async function getPlace(slug: string): Promise<PublicPlace | null> {
  const place = await getPublicPlace(slug);
  if (!place) return null;
  const whole = place.bookingUnit === "WHOLE_PLACE";
  const [units, placePhotos, rooms] = await Promise.all([
    listPublicUnits(place.id, BOOKABLE_ROOM_KIND[place.bookingUnit]),
    listPlacePhotos(place.id),
    whole ? listPublicUnits(place.id, "ROOM") : null,
  ]);
  return {
    slug: place.slug,
    name: place.name,
    description: place.description,
    area: place.area,
    currency: place.currency,
    checkInTime: place.checkInTime,
    checkOutTime: place.checkOutTime,
    holdHours: place.holdHours,
    houseRules: place.houseRules,
    bookingUnit: place.bookingUnit,
    bookingMode: place.bookingMode,
    photos: placePhotos.length > 0 ? placePhotos : (rooms ?? units).flatMap((unit) => unit.photos),
    units,
    rooms: rooms ?? units,
  };
}

/**
 * The nights a guest cannot book in a room, for its calendar: confirmed stays, held rooms, platform stays and closed
 * dates, as dates only. Asked of the same room a quote is (a room the place does not book by is not found).
 */
export async function getRoomAvailability(
  slug: string,
  roomId: string,
  range: DateRange,
  now: Date = new Date(),
): Promise<RoomAvailability> {
  const place = await findBookablePlace(slug);
  if (!place) throw notFound("Place");
  const room = await findRoomForBooking(place.id, roomId);
  if (!room?.active || room.kind !== BOOKABLE_ROOM_KIND[place.bookingUnit]) throw notFound("Room");
  return { roomId: room.id, takenNights: await getTakenNights(place.id, room.id, range, now) };
}
