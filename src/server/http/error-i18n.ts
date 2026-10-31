import { LOCALE_COOKIE, type Locale, pickLocale } from "@/config/appearance";

/** The visitor's language for an API response: the saved choice, else the browser's. */
export function requestLocale(request: Request): Locale {
  const saved = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  return pickLocale(saved, request.headers.get("accept-language"));
}
