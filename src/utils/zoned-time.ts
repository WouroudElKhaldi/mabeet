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

/** How far the zone's clock is ahead of UTC at this instant, in minutes. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/**
 * The instant a wall-clock time happens where the business is: "2026-11-07" at "17:00" in "Asia/Beirut". Sessions
 * start at a local time and are stored as instants. The offset is asked twice, so a date across a summer-time change
 * still lands on the right hour.
 */
export function zonedInstant(isoDate: string, time: string, timeZone: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hours, minutes);
  const firstGuess = new Date(wallClockAsUtc - offsetMinutes(new Date(wallClockAsUtc), timeZone) * 60_000);
  return new Date(wallClockAsUtc - offsetMinutes(firstGuess, timeZone) * 60_000);
}
