import { describe, expect, it } from "vitest";
import { toIsoDate, todayUtc } from "@/utils/dates";
import { AVAILABILITY_DAYS, availabilityWindow } from "../availability-window";
import { availabilityQuery, quoteQuery } from "../schemas";

describe("availabilityQuery", () => {
  it("reads a window as a range of nights", () => {
    const { range } = availabilityQuery.parse({ from: "2026-11-14", to: "2026-12-14" });
    expect(toIsoDate(range.checkIn)).toBe("2026-11-14");
    expect(toIsoDate(range.checkOut)).toBe("2026-12-14");
  });

  it("starts today and covers the year ahead when nothing is said", () => {
    const { range } = availabilityQuery.parse({});
    expect(toIsoDate(range.checkIn)).toBe(toIsoDate(todayUtc()));
    expect((range.checkOut.getTime() - range.checkIn.getTime()) / 86_400_000).toBe(AVAILABILITY_DAYS);
  });

  it("counts a year from the start given, when only the start is given", () => {
    const { range } = availabilityQuery.parse({ from: "2026-11-14" });
    expect(toIsoDate(range.checkOut)).toBe("2027-11-14");
  });

  it("refuses an end that is not after the start, and dates that are not dates", () => {
    expect(availabilityQuery.safeParse({ from: "2026-11-14", to: "2026-11-14" }).success).toBe(false);
    expect(availabilityQuery.safeParse({ from: "2026-11-14", to: "2026-11-01" }).success).toBe(false);
    expect(availabilityQuery.safeParse({ from: "soon" }).success).toBe(false);
    expect(availabilityQuery.safeParse({ to: "2026-02-31" }).success).toBe(false);
  });
});

describe("availabilityWindow", () => {
  it("starts on today's date in UTC, like the booking engine, and ends a year later", () => {
    expect(availabilityWindow(new Date("2026-11-14T23:30:00Z"))).toEqual({
      from: "2026-11-14",
      to: "2027-11-14",
    });
  });
});

describe("quoteQuery", () => {
  it("turns the dates into a range and an unknown guest count into null", () => {
    const { range, guests } = quoteQuery.parse({ checkIn: "2026-11-14", checkOut: "2026-11-16" });
    expect(toIsoDate(range.checkOut)).toBe("2026-11-16");
    expect(guests).toBeNull();
    expect(quoteQuery.parse({ checkIn: "2026-11-14", checkOut: "2026-11-16", guests: "3" }).guests).toBe(3);
  });
});
