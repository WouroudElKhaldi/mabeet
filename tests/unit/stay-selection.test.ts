import { describe, expect, it } from "vitest";
import {
  EMPTY_STAY,
  canEndAt,
  canStartAt,
  dayAvailability,
  isCompleteStay,
  nightsBetween,
  pickDay,
  sanitizeStay,
} from "@/utils/stay-selection";
import type { StayRules } from "@/utils/stay-selection";

const rules = (overrides: Partial<StayRules> = {}): StayRules => ({
  minDate: "2026-11-10",
  maxDate: "2027-11-10",
  taken: new Set<string>(),
  minNights: 1,
  ...overrides,
});

describe("nightsBetween", () => {
  it("counts nights across month ends and the daylight-saving change", () => {
    expect(nightsBetween("2026-11-30", "2026-12-02")).toBe(2);
    expect(nightsBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("canStartAt", () => {
  it("refuses the past but allows today", () => {
    expect(canStartAt("2026-11-09", rules())).toBe(false);
    expect(canStartAt("2026-11-10", rules())).toBe(true);
  });

  it("refuses a taken night but allows a day after the last taken one", () => {
    const taken = new Set(["2026-11-12", "2026-11-13"]);
    expect(canStartAt("2026-11-12", rules({ taken }))).toBe(false);
    expect(canStartAt("2026-11-14", rules({ taken }))).toBe(true);
  });

  it("allows arriving on the day the last guest leaves", () => {
    // Nights 12th and 13th are taken: the other guest leaves on the 14th.
    expect(canStartAt("2026-11-14", rules({ taken: new Set(["2026-11-12", "2026-11-13"]) }))).toBe(true);
  });

  it("needs room for the minimum stay before the next taken night", () => {
    const taken = new Set(["2026-11-13"]);
    expect(canStartAt("2026-11-12", rules({ taken, minNights: 1 }))).toBe(true);
    expect(canStartAt("2026-11-12", rules({ taken, minNights: 2 }))).toBe(false);
    expect(canStartAt("2026-11-11", rules({ taken, minNights: 2 }))).toBe(true);
  });

  it("needs the check-out to fit inside the calendar", () => {
    expect(canStartAt("2027-11-10", rules())).toBe(false);
    expect(canStartAt("2027-11-09", rules())).toBe(true);
  });

  it("is impossible when the minimum stay is longer than the longest stay", () => {
    expect(canStartAt("2026-11-12", rules({ minNights: 5, maxNights: 3 }))).toBe(false);
  });
});

describe("canEndAt", () => {
  it("allows leaving on the day a taken night begins", () => {
    const taken = new Set(["2026-11-15"]);
    expect(canEndAt("2026-11-12", "2026-11-15", rules({ taken }))).toBe(true);
    expect(canEndAt("2026-11-12", "2026-11-16", rules({ taken }))).toBe(false);
  });

  it("refuses the same day, an earlier day and a stay shorter than the minimum", () => {
    expect(canEndAt("2026-11-12", "2026-11-12", rules())).toBe(false);
    expect(canEndAt("2026-11-12", "2026-11-11", rules())).toBe(false);
    expect(canEndAt("2026-11-12", "2026-11-13", rules({ minNights: 2 }))).toBe(false);
    expect(canEndAt("2026-11-12", "2026-11-14", rules({ minNights: 2 }))).toBe(true);
  });

  it("refuses a stay longer than the longest stay, and one past the calendar", () => {
    expect(canEndAt("2026-11-12", "2026-11-15", rules({ maxNights: 3 }))).toBe(true);
    expect(canEndAt("2026-11-12", "2026-11-16", rules({ maxNights: 3 }))).toBe(false);
    expect(canEndAt("2027-11-08", "2027-11-11", rules())).toBe(false);
  });
});

describe("pickDay", () => {
  it("starts a stay, then ends it", () => {
    const started = pickDay(EMPTY_STAY, "2026-11-12", rules());
    expect(started).toEqual({ checkIn: "2026-11-12", checkOut: null });
    expect(pickDay(started, "2026-11-15", rules())).toEqual({
      checkIn: "2026-11-12",
      checkOut: "2026-11-15",
    });
  });

  it("starts again after a complete stay", () => {
    const complete = { checkIn: "2026-11-12", checkOut: "2026-11-15" };
    expect(pickDay(complete, "2026-11-20", rules())).toEqual({ checkIn: "2026-11-20", checkOut: null });
  });

  it("moves the check-in when the second click is on the same day or before it", () => {
    const started = { checkIn: "2026-11-15", checkOut: null };
    expect(pickDay(started, "2026-11-15", rules())).toEqual({ checkIn: "2026-11-15", checkOut: null });
    expect(pickDay(started, "2026-11-12", rules())).toEqual({ checkIn: "2026-11-12", checkOut: null });
  });

  it("starts again beyond a taken night instead of making a stay over it", () => {
    const taken = new Set(["2026-11-14"]);
    const started = { checkIn: "2026-11-12", checkOut: null };
    expect(pickDay(started, "2026-11-20", rules({ taken }))).toEqual({
      checkIn: "2026-11-20",
      checkOut: null,
    });
  });

  it("allows the check-out on the first taken night", () => {
    const taken = new Set(["2026-11-14"]);
    const started = { checkIn: "2026-11-12", checkOut: null };
    expect(pickDay(started, "2026-11-14", rules({ taken }))).toEqual({
      checkIn: "2026-11-12",
      checkOut: "2026-11-14",
    });
  });

  it("changes nothing on a day that can do neither", () => {
    const taken = new Set(["2026-11-14"]);
    const started = { checkIn: "2026-11-12", checkOut: null };
    expect(pickDay(started, "2026-11-09", rules({ taken }))).toBe(started);
    expect(pickDay(EMPTY_STAY, "2026-11-14", rules({ taken }))).toBe(EMPTY_STAY);
  });
});

describe("dayAvailability", () => {
  const taken = new Set(["2026-11-14"]);

  it("tells the past and the far future (outside) from taken nights (unavailable)", () => {
    expect(dayAvailability("2026-11-09", EMPTY_STAY, rules({ taken }))).toBe("outside");
    expect(dayAvailability("2027-11-11", EMPTY_STAY, rules({ taken }))).toBe("outside");
    expect(dayAvailability("2026-11-14", EMPTY_STAY, rules({ taken }))).toBe("unavailable");
    expect(dayAvailability("2026-11-12", EMPTY_STAY, rules({ taken }))).toBe("open");
  });

  it("shows a taken day as open while it can end the stay", () => {
    const started = { checkIn: "2026-11-12", checkOut: null };
    expect(dayAvailability("2026-11-14", started, rules({ taken }))).toBe("open");
    expect(dayAvailability("2026-11-14", EMPTY_STAY, rules({ taken }))).toBe("unavailable");
  });
});

describe("sanitizeStay", () => {
  it("keeps a good stay", () => {
    const good = { checkIn: "2026-11-12", checkOut: "2026-11-15" };
    expect(sanitizeStay(good, rules())).toEqual(good);
    expect(sanitizeStay({ checkIn: "2026-11-12", checkOut: null }, rules())).toEqual({
      checkIn: "2026-11-12",
      checkOut: null,
    });
  });

  it("drops anything that does not fit", () => {
    const bad = [
      { checkIn: "2026-11-01", checkOut: "2026-11-15" }, // in the past
      { checkIn: "2026-11-15", checkOut: "2026-11-12" }, // back to front
      { checkIn: "2026-11-15", checkOut: "2026-11-15" }, // no night
      { checkIn: "2026-11-12", checkOut: "2026-11-16" }, // over a taken night (below)
      { checkIn: "not a date", checkOut: "2026-11-16" },
      { checkIn: "2026-11-12", checkOut: "2026-02-31" },
      { checkIn: null, checkOut: "2026-11-16" },
    ];
    for (const stay of bad) {
      expect(sanitizeStay(stay, rules({ taken: new Set(["2026-11-14"]) }))).toEqual(EMPTY_STAY);
    }
  });

  it("knows what a complete stay is", () => {
    expect(isCompleteStay({ checkIn: "2026-11-12", checkOut: "2026-11-15" })).toBe(true);
    expect(isCompleteStay({ checkIn: "2026-11-12", checkOut: null })).toBe(false);
    expect(isCompleteStay(EMPTY_STAY)).toBe(false);
  });
});
