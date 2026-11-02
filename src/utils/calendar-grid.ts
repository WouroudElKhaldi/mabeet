import { addDays, parseIsoDate, toIsoDate } from "./dates";

// The shape of a month on screen, worked out on ISO dates ("2026-11-14") so that no time zone can move a day.
// Week days are numbered like ISO 8601: Monday 1 ... Sunday 7. Lebanon starts its week on Monday.

export type WeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const WEEK_STARTS_ON: WeekDay = 1;

// A Monday, used to get the seven week day names in the order a week starts with.
const A_MONDAY = "2024-01-01";

/** The first day of a day's month: "2026-11-14" gives "2026-11-01". */
export function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** The first day of the month `months` away (negative for before). */
export function shiftMonth(isoDate: string, months: number): string {
  const date = parseIsoDate(monthStart(isoDate));
  return toIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)));
}

function isoWeekDay(date: Date): WeekDay {
  return (date.getUTCDay() === 0 ? 7 : date.getUTCDay()) as WeekDay;
}

/** Seven dates, one per week day, in the order the week starts with: for the column headings. */
export function weekDayDates(weekStartsOn: WeekDay = WEEK_STARTS_ON): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    toIsoDate(addDays(parseIsoDate(A_MONDAY), weekStartsOn - 1 + index)),
  );
}

/** A month as rows of seven. A place before the 1st or after the last day is `null`. */
export function monthWeeks(isoDate: string, weekStartsOn: WeekDay = WEEK_STARTS_ON): (string | null)[][] {
  const first = parseIsoDate(monthStart(isoDate));
  const padding = (isoWeekDay(first) - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array<null>(padding).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => toIsoDate(addDays(first, index))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}

/**
 * The day that holds the focus when the calendar is entered with the Tab key: the remembered day if it is in the
 * month on screen, otherwise the first day of the month that is not before `earliest`.
 */
export function tabbableDay(month: string, focused: string | null, earliest: string): string {
  if (focused && sameMonth(focused, month)) return focused;
  const first = monthStart(month);
  return sameMonth(earliest, month) && earliest > first ? earliest : first;
}

/**
 * Where an arrow, Page or Home/End key takes the focus, or `null` for any other key. `rtl` is true on an Arabic page,
 * where the right arrow goes to the day before, because the days run from right to left.
 */
export function moveFocus(
  isoDate: string,
  key: string,
  rtl: boolean,
  weekStartsOn: WeekDay = WEEK_STARTS_ON,
): string | null {
  const date = parseIsoDate(isoDate);
  const step = (days: number) => toIsoDate(addDays(date, days));
  switch (key) {
    case "ArrowRight":
      return step(rtl ? -1 : 1);
    case "ArrowLeft":
      return step(rtl ? 1 : -1);
    case "ArrowUp":
      return step(-7);
    case "ArrowDown":
      return step(7);
    case "Home":
      return step(-((isoWeekDay(date) - weekStartsOn + 7) % 7));
    case "End":
      return step(6 - ((isoWeekDay(date) - weekStartsOn + 7) % 7));
    case "PageUp":
    case "PageDown": {
      // The same day number in the next month, or its last day when that month is shorter (31 Jan gives 28 Feb).
      const target = parseIsoDate(shiftMonth(isoDate, key === "PageUp" ? -1 : 1));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      return toIsoDate(addDays(target, Math.min(date.getUTCDate(), lastDay) - 1));
    }
    default:
      return null;
  }
}
