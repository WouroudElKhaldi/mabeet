import { z } from "zod";
import { id, isoDate, stayDates } from "@/lib/schemas";
import { placeParams } from "@/modules/bookings";
import { addDays, parseIsoDate, toDateRange, toIsoDate, todayUtc } from "@/utils/dates";
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
