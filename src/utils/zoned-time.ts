import { toIsoDate } from "./dates";

/**
 * Today's date where the guesthouse is, as an ISO date ("2026-11-14").
 *
 * The server and the guest's phone can be in different zones, and at 01:00 in Beirut it is still yesterday in UTC.
 * Asking the question in the business's zone keeps "the first night you can book" the same for everybody.
 * A zone name the browser does not know falls back to UTC rather than breaking the whole page.
 */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch (caught) {
    if (caught instanceof RangeError) return toIsoDate(now);
    throw caught;
  }
}
