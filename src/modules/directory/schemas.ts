import { z } from "zod";
import { MAX_STAY_NIGHTS } from "@/config/booking-limits";
import { AMENITIES } from "@/config/amenities";
import { ACCESSIBILITY, TAGS } from "@/config/listing";
import { id, isoDate, stayDates } from "@/lib/schemas";
import { placeParams } from "@/modules/bookings";
import {
  addDays,
  countNights,
  optionalDateRange,
  parseIsoDate,
  toDateRange,
  toIsoDate,
  todayUtc,
} from "@/utils/dates";
import { AVAILABILITY_DAYS } from "./availability-window";

// The public side's input checks. Each one hands the service its own shape: nights as a DateRange, an unknown
// guest count as null.

/** /api/public/places/{slug}/rooms/{roomId}/... */
export const roomParams = placeParams.extend({ roomId: id });

/** The stay a guest wants priced. The guest count is optional: the dates alone give a price. */
export const quoteQuery = z
  .object({ guests: z.coerce.number().int().min(1).max(30).optional() })
  .and(stayDates)
  .transform(({ checkIn, checkOut, guests }) => ({
    range: toDateRange({ checkIn, checkOut }),
    guests: guests ?? null,
  }));

/**
 * The window of nights a calendar asks about. Both ends are optional: by default it is today and the year after.
 * `to` is the check-out day, like the end of any stay.
 */
export const availabilityQuery = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine(({ from, to }) => !from || !to || to > from, {
    message: "The end must be after the start",
    path: ["to"],
  })
  .transform(({ from, to }) => {
    const start = from ?? toIsoDate(todayUtc());
    return {
      range: toDateRange({
        checkIn: start,
        checkOut: to ?? toIsoDate(addDays(parseIsoDate(start), AVAILABILITY_DAYS)),
      }),
    };
  });

/**
 * A question to a place's host from its Contact host page. The email is where the host replies. The stay is
 * optional (many guests ask before they choose dates), but dates come as a pair a guest could book.
 */
export const hostMessage = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.email().max(254),
    message: z.string().trim().min(10).max(2000),
    checkIn: isoDate.optional(),
    checkOut: isoDate.optional(),
    guests: z.number().int().min(1).max(50).optional(),
  })
  .refine(({ checkIn, checkOut }) => (checkIn === undefined) === (checkOut === undefined), {
    message: "Give both dates, or neither",
    path: ["checkOut"],
  })
  .refine(({ checkIn, checkOut }) => !checkIn || !checkOut || checkOut > checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });

export type HostMessage = z.infer<typeof hostMessage>;

/** A comma-separated list in the address, keeping only the values we know. */
const listOf = <Value extends string>(allowed: readonly Value[]) =>
  z
    .string()
    .max(600)
    .optional()
    .transform((value) =>
      (value ? value.split(",") : []).filter((item): item is Value =>
        (allowed as readonly string[]).includes(item),
      ),
    )
    .catch([]);

/** Category slugs: their list is the admin's, so only their shape is checked here. */
const slugList = z
  .string()
  .max(600)
  .optional()
  .transform((value) => (value ? value.split(",").filter((slug) => /^[a-z0-9-]{1,40}$/.test(slug)) : []))
  .catch([]);

/** A price in whole units of the currency (dollars, not cents), as a guest types it. */
const price = z.coerce.number().int().min(1).max(100_000_000).optional().catch(undefined);

/**
 * A search as the address holds it (`/search?area=ehden&checkIn=...`), so a search can be shared. Anything wrong is
 * dropped rather than failing the page. Dates count only as a pair a guest could book: check-out after check-in, at
 * most the longest stay.
 */
export const searchParams = z
  .object({
    area: z.string().trim().max(60).optional().catch(undefined),
    q: z.string().trim().max(120).optional().catch(undefined),
    category: slugList,
    tags: listOf(TAGS),
    amenities: listOf(AMENITIES),
    access: listOf(ACCESSIBILITY),
    guests: z.coerce.number().int().min(1).max(30).catch(1),
    minPrice: price,
    maxPrice: price,
    checkIn: isoDate.optional().catch(undefined),
    checkOut: isoDate.optional().catch(undefined),
  })
  .transform(({ checkIn, checkOut, ...search }) => {
    const range = optionalDateRange(checkIn, checkOut);
    const bookable = range !== undefined && countNights(range) <= MAX_STAY_NIGHTS;
    return { ...search, checkIn: bookable ? checkIn : undefined, checkOut: bookable ? checkOut : undefined };
  });

export type SearchState = z.infer<typeof searchParams>;
