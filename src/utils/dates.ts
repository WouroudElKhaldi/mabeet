// A night is a calendar date. Stays are half-open ranges [checkIn, checkOut),
// stored as Postgres DATE and handled here as UTC-midnight Date objects.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export interface DateRange {
  checkIn: Date;
  checkOut: Date;
}

export function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new RangeError(`Invalid date: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || toIsoDate(date) !== value) {
    throw new RangeError(`Invalid date: ${value}`);
  }
  return date;
}

export function toDateRange({ checkIn, checkOut }: { checkIn: string; checkOut: string }): DateRange {
  return { checkIn: parseIsoDate(checkIn), checkOut: parseIsoDate(checkOut) };
}

/** A range only when both dates are present and in order; otherwise undefined ("any dates"). */
export function optionalDateRange(checkIn?: string, checkOut?: string): DateRange | undefined {
  return checkIn && checkOut && checkOut > checkIn ? toDateRange({ checkIn, checkOut }) : undefined;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function countNights({ checkIn, checkOut }: DateRange): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}

export function eachNight(range: DateRange): Date[] {
  return Array.from({ length: countNights(range) }, (_, index) => addDays(range.checkIn, index));
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.checkIn < b.checkOut && b.checkIn < a.checkOut;
}

export function todayUtc(now: Date = new Date()): Date {
  return parseIsoDate(toIsoDate(now));
}
