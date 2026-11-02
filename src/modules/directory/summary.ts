import { AMENITIES } from "@/config/amenities";
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
