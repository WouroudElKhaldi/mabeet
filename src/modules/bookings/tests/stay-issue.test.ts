import { describe, expect, it } from "vitest";
import { MAX_DAYS_AHEAD, MAX_STAY_NIGHTS, STAY_ISSUES, type StayIssue } from "@/config/booking-limits";
import { addDays, type DateRange, parseIsoDate, todayUtc } from "@/utils/dates";
import { assertBookableStay, stayIssue } from "../server/booking-policy";

// The one rule for whether a stay can be booked as asked: the booking engine refuses with it, and the public quote
// shows it. A fixed "now", so no test depends on the day it runs.
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

  it("can give every issue in STAY_ISSUES, so the list the screen translates and the rules never drift apart", () => {
    const stayFor: Record<StayIssue, () => StayIssue | null> = {
      PAST: () => check(stayFrom(-1, 3)),
      TOO_FAR: () => check(stayFrom(MAX_DAYS_AHEAD + 1, 2)),
      TOO_LONG: () => check(stayFrom(5, MAX_STAY_NIGHTS + 1)),
      MIN_NIGHTS: () => check(stayFrom(5, 1)),
      CAPACITY: () => check(stayFrom(5, 3), 5),
    };
    expect(Object.keys(stayFor).sort()).toEqual([...STAY_ISSUES].sort());
    for (const issue of STAY_ISSUES) expect(stayFor[issue]()).toBe(issue);
  });

  it("checks only the dates when the room is not known yet", () => {
    expect(stayIssue({ range: stayFrom(5, 1), guests: 9 }, now)).toBeNull();
    expect(stayIssue({ range: stayFrom(-1, 1), guests: null }, now)).toBe("PAST");
  });
});

describe("assertBookableStay", () => {
  it("refuses with a sentence the guest understands, naming the room's own limit", () => {
    const refusal = (range: DateRange, guests: number | null = null) => {
      try {
        assertBookableStay({ range, guests, room }, now);
        return null;
      } catch (error) {
        return error;
      }
    };
    expect(refusal(stayFrom(10, 3), 2)).toBeNull();
    expect(refusal(stayFrom(-1, 3))).toMatchObject({
      code: "VALIDATION",
      message: "Check-in cannot be in the past",
    });
    expect(refusal(stayFrom(5, MAX_STAY_NIGHTS + 1))).toMatchObject({
      message: `Stays are limited to ${MAX_STAY_NIGHTS} nights`,
    });
    expect(refusal(stayFrom(5, 1))).toMatchObject({ message: "This room needs at least 2 nights" });
    expect(refusal(stayFrom(5, 3), 5)).toMatchObject({ message: "This room sleeps up to 4" });
  });
});
