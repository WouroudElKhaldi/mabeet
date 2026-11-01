/** English, Modern Standard Arabic, and Lebanese Arabic ("ar-LB", the way people actually talk in Lebanon). */
export const LOCALES = ["en", "ar", "ar-LB"] as const;
export type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Both Arabic variants read right to left and use the Arabic names stored on categories. */
export const isArabic = (locale: string) => locale.startsWith("ar");

/** The saved choice wins; otherwise the browser's languages decide (Lebanese for ar-LB, else Arabic or English). */
export function pickLocale(saved: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(saved)) return saved;
  const accepted = (acceptLanguage ?? "").toLowerCase();
  if (accepted.startsWith("ar-lb")) return "ar-LB";
  return accepted.startsWith("ar") ? "ar" : DEFAULT_LOCALE;
}

/** The five colour palettes (docs/team/08, Part 2). The platform admin picks one for the whole site. */
export const PALETTES = ["cedar", "byblos", "batroun", "baalbek", "jounieh"] as const;
export type Palette = (typeof PALETTES)[number];
export const DEFAULT_PALETTE: Palette = "cedar";

/** Each visitor chooses light or dark; the choice is kept in this browser. */
export type Mode = "light" | "dark";
export const MODE_STORAGE_KEY = "mabeet-mode";
