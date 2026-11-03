import { AMENITIES } from "@/config/amenities";
import { eachNight, toDateRange, toIsoDate } from "@/utils/dates";
import { isIsoDate } from "@/utils/stay-selection";
import type { BookingUnit } from "@prisma/client";
import type { PublicUnit } from "./types";

// Small sums a place page needs, apart from how they are drawn.

/** How many the place sleeps and has: the rooms added up, or the one whole-place unit as it is. */
export function summarizeUnits(units: readonly PublicUnit[], bookingUnit: BookingUnit) {
  const counted = bookingUnit === "WHOLE_PLACE" ? units.slice(0, 1) : units;
  const sum = (field: "capacity" | "bedrooms" | "beds" | "bathrooms") =>
    counted.reduce((total, unit) => total + unit[field], 0);
  return {
    guests: sum("capacity"),
    bedrooms: sum("bedrooms"),
    beds: sum("beds"),
    bathrooms: sum("bathrooms"),
  };
}

/** The lowest price a night among these units, or null when there are none: the "from" price. */
export function lowestRateCents(units: readonly PublicUnit[]): number | null {
  return units.length === 0 ? null : Math.min(...units.map((unit) => unit.baseRateCents));
}

/** The amenities any of these units has, in the order the screens list them. Unknown ones are dropped. */
export function amenitiesOf(units: readonly PublicUnit[]) {
  const offered = new Set(units.flatMap((unit) => unit.amenities));
  return AMENITIES.filter((amenity) => offered.has(amenity));
}

/** Every night costs the same, so a stay can be shown as "3 nights × $90". */
export function hasUniformRate(nights: readonly { rateCents: number }[]): boolean {
  return nights.length > 0 && nights.every((night) => night.rateCents === nights[0]?.rateCents);
}

/**
 * The stay a page's address asks for (/p/{slug}?room=&checkIn=&checkOut=&guests=), keeping only what is well formed:
 * a link can say anything, and what does not fit is dropped rather than shown. Whether the dates can be booked is the
 * calendar's question, asked when it opens.
 */
export function initialStay(query: Record<string, string | string[] | undefined>) {
  const text = (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value : undefined;
  };
  const stay: { roomId?: string; checkIn?: string; checkOut?: string; guests?: number } = {};
  const room = text("room");
  if (room && room.length <= 64) stay.roomId = room;
  const checkIn = text("checkIn") ?? null;
  const checkOut = text("checkOut") ?? null;
  if (isIsoDate(checkIn) && isIsoDate(checkOut) && checkOut > checkIn) {
    stay.checkIn = checkIn;
    stay.checkOut = checkOut;
  }
  const guests = Number(text("guests"));
  if (Number.isInteger(guests) && guests >= 1 && guests <= 30) stay.guests = guests;
  return stay;
}

/** Whether any night of the stay is in the taken nights (the check-out night is not slept, so it does not count). */
export function stayHitsTakenNights(
  stay: { checkIn: string; checkOut: string },
  taken: readonly string[],
): boolean {
  if (taken.length === 0) return false;
  const takenSet = new Set(taken);
  return eachNight(toDateRange(stay)).some((night) => takenSet.has(toIsoDate(night)));
}
