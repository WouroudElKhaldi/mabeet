import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, pickLocale } from "@/config/appearance";
import type { Locale } from "@/config/appearance";
import type en from "../../messages/en.json";

// One loader per language, so each language is its own file in the build and the type checker finds a missing one.
const loadMessages: Record<Locale, () => Promise<{ default: typeof en }>> = {
  en: () => import("../../messages/en.json"),
  ar: () => import("../../messages/ar.json"),
  "ar-LB": () => import("../../messages/ar-LB.json"),
};

// The language is not in the address: the visitor's saved choice decides, then their browser's (`pickLocale`, the
// same rule the API and the emails use). So a shared link opens in the reader's own language.
export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = pickLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerStore.get("accept-language"));
  const messages = (await loadMessages[locale]()).default;
  return { locale, messages };
});
