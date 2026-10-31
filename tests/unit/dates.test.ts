import { describe, expect, it } from "vitest";
import {
  addDays,
  countNights,
  eachNight,
  optionalDateRange,
  parseIsoDate,
  rangesOverlap,
  toDateRange,
  todayUtc,
  toIsoDate,
} from "@/utils/dates";

const range = (checkIn: string, checkOut: string) => ({
  checkIn: parseIsoDate(checkIn),
  checkOut: parseIsoDate(checkOut),
});

describe("dates", () => {
  it("parses ISO dates as UTC midnight and rejects impossible ones", () => {
    expect(toIsoDate(parseIsoDate("2026-10-31"))).toBe("2026-10-31");
    expect(() => parseIsoDate("2026-02-30")).toThrow(RangeError);
    expect(() => parseIsoDate("31/10/2026")).toThrow(RangeError);
  });

  it("counts nights across month ends", () => {
    expect(countNights(range("2026-10-30", "2026-11-02"))).toBe(3);
    expect(eachNight(range("2026-10-30", "2026-11-01")).map(toIsoDate)).toEqual(["2026-10-30", "2026-10-31"]);
  });

  it("treats back-to-back stays as not overlapping", () => {
    expect(rangesOverlap(range("2026-11-01", "2026-11-03"), range("2026-11-03", "2026-11-05"))).toBe(false);
    expect(rangesOverlap(range("2026-11-01", "2026-11-04"), range("2026-11-03", "2026-11-05"))).toBe(true);
  });

  it("reads a stay from its two dates, and treats missing or reversed dates as any dates", () => {
    expect(countNights(toDateRange({ checkIn: "2026-11-12", checkOut: "2026-11-15" }))).toBe(3);
    expect(optionalDateRange("2026-11-12", "2026-11-15")).toEqual(range("2026-11-12", "2026-11-15"));
    expect(optionalDateRange("2026-11-15", "2026-11-12")).toBeUndefined();
    expect(optionalDateRange("2026-11-12")).toBeUndefined();
  });

  it("moves across month and year ends, and takes today as a date with no time", () => {
    expect(toIsoDate(addDays(parseIsoDate("2026-12-31"), 1))).toBe("2027-01-01");
    expect(toIsoDate(addDays(parseIsoDate("2026-03-01"), -1))).toBe("2026-02-28");
    expect(todayUtc(new Date("2026-11-03T23:30:00Z"))).toEqual(parseIsoDate("2026-11-03"));
  });
});
