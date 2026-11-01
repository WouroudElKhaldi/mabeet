// Money and dates as people read them, in their language. Nights are UTC-midnight dates (src/utils/dates.ts), so
// they are always formatted in UTC: a stay never shifts by a day in another time zone.

/** Whole minor units, shown with decimals only when there are some: "$90", "$90.50", "LBP 4,500,000". */
export function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** A stay's check-in and check-out dates as one short range, e.g. "12 – 15 Nov". */
export function formatStayDates(checkIn: Date, checkOut: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).formatRange(
    checkIn,
    checkOut,
  );
}
