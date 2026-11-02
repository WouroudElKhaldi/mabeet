import { BOOKABLE_ROOM_KIND, MAX_STAY_NIGHTS, type StayIssue } from "@/config/booking-limits";
import { stayIssue } from "@/modules/bookings/server";
import { findRoomForBooking, priceStay } from "@/modules/rooms/server";
import { findBookablePlace } from "@/modules/workspaces/server";
import { notFound } from "@/server/errors";
import { countNights, type DateRange } from "@/utils/dates";

// The public side: what a guest can see and ask before signing in. Nothing here takes or frees nights; the booking
// engine does. Whether a stay can be booked is the engine's own rule (`stayIssue`), so a quote never promises what
// booking would refuse.

interface RoomQuote {
  roomId: string;
  currency: string;
  /** The price of each night; empty when the stay is too long to price. */
  nights: { date: string; rateCents: number }[];
  nightCount: number;
  /** What the guest pays, in full: there are no deposits. */
  totalCents: number;
  /** Why the stay cannot be booked as asked, or null. */
  issue: StayIssue | null;
}

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
  // A room the place does not book by (a room of a place that books whole) cannot be priced or booked.
  if (!room || room.kind !== BOOKABLE_ROOM_KIND[place.bookingUnit]) throw notFound("Room");

  const nightCount = countNights(range);
  const issue = stayIssue({ range, guests, room }, now);
  const quote = nightCount > MAX_STAY_NIGHTS ? { nights: [], totalCents: 0 } : await priceStay(room, range);
  return { roomId: room.id, currency: place.currency, nightCount, issue, ...quote };
}
