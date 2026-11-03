import { z } from "zod";
import { isoDate } from "@/lib/schemas";
import { addDays, parseIsoDate, toDateRange, toIsoDate, todayUtc } from "@/utils/dates";

// The analytics module's input checks.

/** The period analytics covers unless asked: the last 30 days, today included. */
const DEFAULT_PERIOD_DAYS = 30;
/** The longest period one read covers: two years of nights. */
const MAX_PERIOD_DAYS = 731;

/**
 * The period of a report: `from` the first day, `to` the day after the last, like a stay. Both optional: by default
 * the last 30 days, today included.
 */
export const analyticsQuery = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .transform(({ from, to }) => {
    const end = to ?? toIsoDate(addDays(todayUtc(), 1));
    const start = from ?? toIsoDate(addDays(parseIsoDate(end), -DEFAULT_PERIOD_DAYS));
    return { checkIn: start, checkOut: end };
  })
  .refine(({ checkIn, checkOut }) => checkOut > checkIn, {
    message: "The end must be after the start",
    path: ["to"],
  })
  .refine(
    ({ checkIn, checkOut }) =>
      parseIsoDate(checkOut).getTime() - parseIsoDate(checkIn).getTime() <= MAX_PERIOD_DAYS * 86_400_000,
    { message: `Ask about ${MAX_PERIOD_DAYS} days at most`, path: ["from"] },
  )
  .transform((period) => toDateRange(period));
