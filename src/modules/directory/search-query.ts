import { type DateRange, optionalDateRange } from "@/utils/dates";
import type { SearchState } from "./schemas";

/** What `searchPlaces` is asked: the place's filters, the unit's, and the stay. Prices in minor units. */
export interface PlaceSearch {
  area?: string;
  text?: string;
  categories?: readonly string[];
  tags?: readonly string[];
  accessibility?: readonly string[];
  amenities?: readonly string[];
  guests: number;
  minRateCents?: number;
  maxRateCents?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minBeds?: number;
  /** Without dates every matching unit is shown at its base price; with them, only units free on every night. */
  range?: DateRange;
  limit: number;
}

/** Prices are typed in whole units of the currency; they are stored in minor units. */
const toCents = (amount: number | undefined) => (amount === undefined ? undefined : amount * 100);

/** The search a page's address asks for, as `searchPlaces` takes it. */
export function toPlaceSearch(state: SearchState, limit: number): PlaceSearch {
  return {
    area: state.area,
    text: state.q,
    categories: state.category,
    tags: state.tags,
    accessibility: state.access,
    amenities: state.amenities,
    guests: state.guests,
    minRateCents: toCents(state.minPrice),
    maxRateCents: toCents(state.maxPrice),
    range: optionalDateRange(state.checkIn, state.checkOut),
    limit,
  };
}
