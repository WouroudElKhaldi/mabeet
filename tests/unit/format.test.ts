import { describe, expect, it } from "vitest";
import { LOCALES } from "@/config/appearance";
import { formatDate, formatMoney } from "@/utils/format";

const arabicIndicDigits = /[٠-٩]/;

describe("formatMoney", () => {
  it("turns whole minor units into the currency's amount", () => {
    expect(formatMoney(9999, "USD", "en")).toBe("$99.99");
    expect(formatMoney(900_000_000, "LBP", "en")).toContain("9,000,000");
  });

  it("writes the digits 0 to 9 in every language", () => {
    for (const locale of LOCALES) {
      expect(formatMoney(123_456, "USD", locale)).not.toMatch(arabicIndicDigits);
      expect(formatMoney(123_456, "USD", locale)).toContain("1,234.56");
    }
  });

  it("writes the same number in both Arabic languages, with a decimal point, never a decimal comma", () => {
    expect(formatMoney(9999, "USD", "ar-LB")).toBe(formatMoney(9999, "USD", "ar"));
    expect(formatMoney(9999, "USD", "ar-LB")).toContain("99.99");
  });
});

describe("formatDate", () => {
  it("shows the day that was given, whatever time zone the computer is in", () => {
    expect(formatDate("2026-11-14", "en")).toBe("Sat, Nov 14");
    expect(formatDate("2026-01-01", "en", { day: "numeric", month: "long", year: "numeric" })).toBe(
      "January 1, 2026",
    );
  });

  it("uses the digits 0 to 9 in Arabic too", () => {
    expect(formatDate("2026-11-14", "ar")).not.toMatch(arabicIndicDigits);
    expect(formatDate("2026-11-14", "ar")).toContain("14");
  });

  it("names the month the way each language says it: Lebanese Arabic uses the Levantine names", () => {
    expect(formatDate("2026-11-14", "ar")).toContain("نوفمبر");
    expect(formatDate("2026-11-14", "ar-LB")).toContain("تشرين الثاني");
  });
});
