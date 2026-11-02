import { describe, expect, it } from "vitest";
import { todayIn } from "@/utils/zoned-time";

describe("todayIn", () => {
  it("is the date where the guesthouse is, not the date in UTC", () => {
    // 23:30 UTC on 14 Nov is already 01:30 on the 15th in Beirut (UTC+2 in winter).
    const now = new Date("2026-11-14T23:30:00Z");
    expect(todayIn("Asia/Beirut", now)).toBe("2026-11-15");
    expect(todayIn("UTC", now)).toBe("2026-11-14");
  });

  it("goes the other way for a zone behind UTC", () => {
    expect(todayIn("America/New_York", new Date("2026-11-14T03:00:00Z"))).toBe("2026-11-13");
  });

  it("follows summer time (UTC+3 in Beirut)", () => {
    expect(todayIn("Asia/Beirut", new Date("2026-07-14T21:30:00Z"))).toBe("2026-07-15");
  });

  it("pads the month and day", () => {
    expect(todayIn("UTC", new Date("2026-03-04T10:00:00Z"))).toBe("2026-03-04");
  });

  it("falls back to UTC for a zone name nobody knows, instead of throwing", () => {
    expect(todayIn("Mars/Olympus", new Date("2026-11-14T23:30:00Z"))).toBe("2026-11-14");
  });
});
