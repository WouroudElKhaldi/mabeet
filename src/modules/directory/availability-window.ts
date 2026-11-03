import { addDays, toIsoDate, todayUtc } from "@/utils/dates";

/** How many nights ahead the calendar shows what is taken: one read of the availability answers for all of them. */
export const AVAILABILITY_DAYS = 365;

/** The first and last night of the window that starts today, as ISO dates. */
export function availabilityWindow(now: Date = new Date()) {
  const from = todayUtc(now);
  return { from: toIsoDate(from), to: toIsoDate(addDays(from, AVAILABILITY_DAYS)) };
}
