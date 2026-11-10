import type { Locale } from "@/config/appearance";
import { parseIsoDate } from "./dates";

// Numbers use the digits 0 to 9 and dates the Gregorian calendar in every language, as people in Lebanon write them
// (and as the phone and price fields are typed). Month names still come from the language: "Nov" or, in Lebanese
// Arabic, "تشرين الثاني".
function dateLocale(locale: Locale): string {
  return `${locale}-u-ca-gregory-nu-latn`;
}

// Lebanese Arabic's own number format has a decimal comma ("99,99"), which next to the dollar prices seen everywhere
// else reads as thousands. Money is too important to leave to that: both Arabic languages write "99.99".
const numberLanguage: Record<Locale, string> = { en: "en", ar: "ar", "ar-LB": "ar" };

/**
 * Money is whole minor units (`...Cents`: 9999 is 99.99 in the record's currency): "$99.99", "LBP 9,000,000".
 * `wholeUnits` drops the cents for a big round figure set large ("$288", not "$288.00"); prices keep them.
 */
export function formatMoney(
  cents: number,
  currency: string,
  locale: Locale,
  { wholeUnits = false }: { wholeUnits?: boolean } = {},
): string {
  return new Intl.NumberFormat(`${numberLanguage[locale]}-u-nu-latn`, {
    style: "currency",
    currency,
    ...(wholeUnits ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(cents / 100);
}

/**
 * The same text on the server and in the browser. Their date libraries differ in one thing: the server's puts thin
 * spaces around a range's dash ("10 – 16"), and narrow ones before "AM", where the browser's puts plain spaces. A page
 * the server wrote and the browser then takes over must read the same in both, or React reports a mismatch. Those two
 * are the thin space (U+2009) and the narrow no-break space (U+202F).
 */
const narrowSpaces = new RegExp(`[${String.fromCodePoint(0x2009, 0x202f)}]`, "g");

function plainSpaces(text: string): string {
  return text.replace(narrowSpaces, " ");
}

/**
 * A calendar date given as an ISO date ("2026-11-14"), shown as "Sat, Nov 14" by default. It is a day, not a moment,
 * so it is read in UTC: no time zone can move a night to the day before.
 */
export function formatDate(
  isoDate: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" },
): string {
  return plainSpaces(
    new Intl.DateTimeFormat(dateLocale(locale), { ...options, timeZone: "UTC" }).format(
      parseIsoDate(isoDate),
    ),
  );
}

/** A stay's check-in and check-out as one short range, "12 – 15 Nov", read in UTC like every night. */
export function formatStayDates(checkIn: Date, checkOut: Date, locale: Locale): string {
  return plainSpaces(
    new Intl.DateTimeFormat(dateLocale(locale), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).formatRange(checkIn, checkOut),
  );
}
