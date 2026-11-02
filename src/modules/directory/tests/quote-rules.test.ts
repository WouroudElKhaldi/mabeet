import { describe, expect, it } from "vitest";
import { MAX_DAYS_AHEAD, MAX_STAY_NIGHTS } from "@/config/booking-limits";
import { addDays, type DateRange, parseIsoDate, todayUtc } from "@/utils/dates";
import { stayIssue } from "../server/quote-rules";

// A fixed "now", so no test depends on the day it runs.
const now = new Date("2026-11-14T10:00:00Z");
const today = todayUtc(now);
const room = { capacity: 4, minNights: 2 };

function stayFrom(daysFromToday: number, nights: number): DateRange {
  const checkIn = addDays(today, daysFromToday);
  return { checkIn, checkOut: addDays(checkIn, nights) };
}

const check = (range: DateRange, guests: number | null = null) => stayIssue({ range, guests, room }, now);

describe("stayIssue", () => {
  it("accepts a stay the engine would take", () => {
    expect(check(stayFrom(10, 3), 2)).toBeNull();
    expect(check(stayFrom(0, 2))).toBeNull();
  });

  it("refuses a check-in before today, but not today itself", () => {
    expect(check(stayFrom(-1, 3))).toBe("PAST");
    expect(check(stayFrom(0, 3))).toBeNull();
  });

  it("reads today in UTC like the booking engine, whatever the hour", () => {
    const lateEvening = new Date("2026-11-14T23:59:00Z");
    expect(stayIssue({ range: stayFrom(0, 2), guests: null, room }, lateEvening)).toBeNull();
    expect(
      stayIssue(
        {
          range: { checkIn: parseIsoDate("2026-11-13"), checkOut: parseIsoDate("2026-11-16") },
          guests: null,
          room,
        },
        lateEvening,
      ),
    ).toBe("PAST");
  });

  it("refuses a check-in too far ahead, on the day after the last one allowed", () => {
    expect(check(stayFrom(MAX_DAYS_AHEAD, 2))).toBeNull();
    expect(check(stayFrom(MAX_DAYS_AHEAD + 1, 2))).toBe("TOO_FAR");
  });

  it("refuses a stay longer than the longest, but not one of exactly that length", () => {
    expect(check(stayFrom(5, MAX_STAY_NIGHTS))).toBeNull();
    expect(check(stayFrom(5, MAX_STAY_NIGHTS + 1))).toBe("TOO_LONG");
  });

  it("refuses a stay shorter than the room's minimum", () => {
    expect(check(stayFrom(5, 1))).toBe("MIN_NIGHTS");
    expect(check(stayFrom(5, 2))).toBeNull();
  });

  it("refuses more guests than the room sleeps, and ignores an unknown guest count", () => {
    expect(check(stayFrom(5, 3), 5)).toBe("CAPACITY");
    expect(check(stayFrom(5, 3), 4)).toBeNull();
    expect(check(stayFrom(5, 3), null)).toBeNull();
  });

  it("names the first problem when there are several", () => {
    expect(check(stayFrom(-3, 1), 9)).toBe("PAST");
    expect(check(stayFrom(5, 1), 9)).toBe("MIN_NIGHTS");
  });
});
