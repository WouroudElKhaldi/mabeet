import type { Locale } from "@/config/appearance";
import type en from "../messages/en.json";

// English is the model: every key of `en.json` is a known key, so `t("typo")` fails the type check, not a guest's page.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
