import { describe, expect, it } from "vitest";
import { toDateRange } from "@/utils/dates";
import { quoteStay } from "../server/pricing";

const range = toDateRange({ checkIn: "2026-12-30", checkOut: "2027-01-02" });

describe("the price of a stay", () => {
  it("adds up the nightly price; the check-out night is free", () => {
    expect(quoteStay({ range, baseRateCents: 9_000, overrides: new Map() })).toEqual({
      nights: [
        { date: "2026-12-30", rateCents: 9_000 },
        { date: "2026-12-31", rateCents: 9_000 },
        { date: "2027-01-01", rateCents: 9_000 },
      ],
      totalCents: 27_000,
    });
  });

  it("uses a special price on its own night only", () => {
    const quote = quoteStay({ range, baseRateCents: 9_000, overrides: new Map([["2026-12-31", 15_000]]) });
    expect(quote.nights.map((night) => night.rateCents)).toEqual([9_000, 15_000, 9_000]);
    expect(quote.totalCents).toBe(33_000);
  });

  it("keeps LBP totals exact past the 32-bit limit", () => {
    const lbp = quoteStay({ range, baseRateCents: 1_000_000_000, overrides: new Map() });
    expect(lbp.totalCents).toBe(3_000_000_000);
  });
});
