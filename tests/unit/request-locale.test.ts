import { describe, expect, it } from "vitest";
import { requestLocale } from "@/server/http/error-i18n";

const from = (headers: Record<string, string>) => new Request("https://mabeet.app/api/test", { headers });

describe("the visitor's language", () => {
  it("follows the language they chose on the site first", () => {
    expect(requestLocale(from({ cookie: "theme=dark; locale=ar-LB", "accept-language": "en-US" }))).toBe(
      "ar-LB",
    );
  });

  it("otherwise follows the browser: Lebanese Arabic, Arabic, or English", () => {
    expect(requestLocale(from({ "accept-language": "ar-LB,ar;q=0.9" }))).toBe("ar-LB");
    expect(requestLocale(from({ "accept-language": "ar-SA" }))).toBe("ar");
    expect(requestLocale(from({ "accept-language": "fr-FR" }))).toBe("en");
    expect(requestLocale(from({}))).toBe("en");
  });

  it("ignores a saved language the site does not have", () => {
    expect(requestLocale(from({ cookie: "locale=xx", "accept-language": "ar" }))).toBe("ar");
  });
});
