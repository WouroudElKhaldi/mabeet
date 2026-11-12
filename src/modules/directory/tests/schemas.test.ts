import { describe, expect, it } from "vitest";
import { toIsoDate, todayUtc } from "@/utils/dates";
import { AVAILABILITY_DAYS, availabilityWindow } from "../availability-window";
import { searchParams, toPlaceSearch } from "..";
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

describe("searchParams", () => {
  it("reads a shared search from the address", () => {
    const state = searchParams.parse({
      area: " Ehden ",
      category: "mountain,village",
      tags: "family-friendly",
      amenities: "wifi,jacuzzi",
      access: "step-free-access",
      guests: "4",
      minPrice: "50",
      maxPrice: "150",
      checkIn: "2026-12-04",
      checkOut: "2026-12-06",
      tab: "experiences",
    });
    expect(state).toEqual({
      area: "Ehden",
      category: ["mountain", "village"],
      tags: ["family-friendly"],
      amenities: ["wifi", "jacuzzi"],
      access: ["step-free-access"],
      guests: 4,
      minPrice: 50,
      maxPrice: 150,
      checkIn: "2026-12-04",
      checkOut: "2026-12-06",
      tab: "experiences",
    });
  });

  it("quietly drops what is wrong instead of failing the page", () => {
    const state = searchParams.parse({
      tab: "castles",
      category: "Mountain!,village",
      amenities: "wifi,teleporter",
      guests: "lots",
      minPrice: "-5",
      checkIn: "someday",
    });
    expect(state).toMatchObject({
      tab: "homes",
      category: ["village"],
      amenities: ["wifi"],
      guests: 1,
      minPrice: undefined,
    });
    expect(state.checkIn).toBeUndefined();
  });

  it("keeps dates only as a stay a guest could book", () => {
    const backwards = searchParams.parse({ checkIn: "2026-12-06", checkOut: "2026-12-04" });
    expect([backwards.checkIn, backwards.checkOut]).toEqual([undefined, undefined]);
    const tooLong = searchParams.parse({ checkIn: "2026-12-01", checkOut: "2027-03-01" });
    expect([tooLong.checkIn, tooLong.checkOut]).toEqual([undefined, undefined]);
    const alone = searchParams.parse({ checkIn: "2026-12-04" });
    expect(alone.checkIn).toBeUndefined();
  });
});

describe("toPlaceSearch", () => {
  it("turns prices into minor units and the dates into a range", () => {
    const search = toPlaceSearch(
      searchParams.parse({ q: "cedar", minPrice: "50", checkIn: "2026-12-04", checkOut: "2026-12-06" }),
      12,
    );
    expect(search).toMatchObject({
      text: "cedar",
      guests: 1,
      minRateCents: 5_000,
      maxRateCents: undefined,
      limit: 12,
    });
    expect(search.range && toIsoDate(search.range.checkOut)).toBe("2026-12-06");
    expect(toPlaceSearch(searchParams.parse({}), 12).range).toBeUndefined();
  });
});
