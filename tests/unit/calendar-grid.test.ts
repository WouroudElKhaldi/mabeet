import { describe, expect, it } from "vitest";
import {
  monthStart,
  monthWeeks,
  moveFocus,
  sameMonth,
  shiftMonth,
  tabbableDay,
  weekDayDates,
} from "@/utils/calendar-grid";

describe("month arithmetic", () => {
  it("finds the first day of a month and compares months", () => {
    expect(monthStart("2026-11-14")).toBe("2026-11-01");
    expect(sameMonth("2026-11-01", "2026-11-30")).toBe(true);
    expect(sameMonth("2026-11-30", "2026-12-01")).toBe(false);
    expect(sameMonth("2025-11-14", "2026-11-14")).toBe(false);
  });

  it("moves across year ends in both directions", () => {
    expect(shiftMonth("2026-11-14", 1)).toBe("2026-12-01");
    expect(shiftMonth("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-15", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-01-31", 13)).toBe("2027-02-01");
  });
});

describe("weekDayDates", () => {
  it("lists a week from Monday, or from another day", () => {
    const names = (start: Parameters<typeof weekDayDates>[0]) =>
      weekDayDates(start).map((date) => new Date(`${date}T00:00:00Z`).getUTCDay());
    expect(names(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(names(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(names(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });
});

describe("monthWeeks", () => {
  it("starts on the right column and pads with nulls (1 Nov 2026 is a Sunday)", () => {
    const weeks = monthWeeks("2026-11-14");
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.at(-1)?.at(-1)).toBeNull();
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("starts on the first column when the 1st is the first day of the week", () => {
    expect(monthWeeks("2026-06-10")[0]?.[0]).toBe("2026-06-01"); // a Monday
  });

  it("handles leap and ordinary Februaries, and a month that fits exactly four rows", () => {
    expect(monthWeeks("2028-02-01").flat().filter(Boolean)).toHaveLength(29);
    const february = monthWeeks("2027-02-01"); // 1 Feb 2027 is a Monday, 28 days
    expect(february).toHaveLength(4);
    expect(february.flat().every(Boolean)).toBe(true);
  });

  it("respects a Sunday start", () => {
    expect(monthWeeks("2026-11-14", 7)[0]?.[0]).toBe("2026-11-01");
  });
});

describe("tabbableDay", () => {
  it("keeps the remembered day when it is on screen", () => {
    expect(tabbableDay("2026-11-01", "2026-11-20", "2026-11-05")).toBe("2026-11-20");
  });

  it("falls back to the first bookable day of the month on screen", () => {
    expect(tabbableDay("2026-11-01", "2026-12-03", "2026-11-05")).toBe("2026-11-05");
    expect(tabbableDay("2026-12-01", null, "2026-11-05")).toBe("2026-12-01");
    expect(tabbableDay("2026-11-01", null, "2026-11-01")).toBe("2026-11-01");
  });
});

describe("moveFocus", () => {
  it("moves by day and week, and flips left and right on an Arabic page", () => {
    expect(moveFocus("2026-11-14", "ArrowRight", false)).toBe("2026-11-15");
    expect(moveFocus("2026-11-14", "ArrowLeft", false)).toBe("2026-11-13");
    expect(moveFocus("2026-11-14", "ArrowRight", true)).toBe("2026-11-13");
    expect(moveFocus("2026-11-14", "ArrowLeft", true)).toBe("2026-11-15");
    expect(moveFocus("2026-11-14", "ArrowDown", false)).toBe("2026-11-21");
    expect(moveFocus("2026-11-14", "ArrowUp", false)).toBe("2026-11-07");
  });

  it("crosses month and year ends", () => {
    expect(moveFocus("2026-12-31", "ArrowRight", false)).toBe("2027-01-01");
    expect(moveFocus("2026-01-01", "ArrowLeft", false)).toBe("2025-12-31");
  });

  it("goes to the start and end of the week", () => {
    expect(moveFocus("2026-11-14", "Home", false)).toBe("2026-11-09"); // Saturday -> Monday
    expect(moveFocus("2026-11-14", "End", false)).toBe("2026-11-15"); // -> Sunday
    expect(moveFocus("2026-11-09", "Home", false)).toBe("2026-11-09");
    expect(moveFocus("2026-11-15", "End", false)).toBe("2026-11-15");
  });

  it("moves a month at a time and shortens to the last day of a short month", () => {
    expect(moveFocus("2026-01-31", "PageDown", false)).toBe("2026-02-28");
    expect(moveFocus("2028-01-31", "PageDown", false)).toBe("2028-02-29");
    expect(moveFocus("2026-03-31", "PageUp", false)).toBe("2026-02-28");
    expect(moveFocus("2026-11-14", "PageDown", false)).toBe("2026-12-14");
  });

  it("ignores every other key", () => {
    expect(moveFocus("2026-11-14", "a", false)).toBeNull();
    expect(moveFocus("2026-11-14", "Enter", false)).toBeNull();
    expect(moveFocus("2026-11-14", "Tab", false)).toBeNull();
  });
});
