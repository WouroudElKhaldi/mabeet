import { z } from "zod";
import { id, stayDates } from "@/lib/schemas";
import { placeParams } from "@/modules/bookings";
import { toDateRange } from "@/utils/dates";

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
