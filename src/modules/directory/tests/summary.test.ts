import { describe, expect, it } from "vitest";
import { bookingHref } from "../booking-link";
import {
  amenitiesOf,
  hasUniformRate,
  initialStay,
  lowestRateCents,
  stayHitsTakenNights,
  summarizeUnits,
} from "../summary";
import type { PublicUnit } from "../types";

const unit = (overrides: Partial<PublicUnit> = {}): PublicUnit => ({
  id: "r1",
  name: "Cedar room",
  description: null,
  capacity: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  baseRateCents: 9_000,
  minNights: 1,
  amenities: [],
  photos: [],
  ...overrides,
});

describe("summarizeUnits", () => {
  it("adds up the rooms of a place booked room by room", () => {
    const rooms = [unit({ capacity: 2, beds: 1 }), unit({ id: "r2", capacity: 4, bedrooms: 2, beds: 3 })];
    expect(summarizeUnits(rooms, "ROOMS")).toEqual({ guests: 6, bedrooms: 3, beds: 4, bathrooms: 2 });
  });

  it("takes the one whole-place unit as it is, never adding anything else to it", () => {
    const units = [unit({ capacity: 8, bedrooms: 4, beds: 6, bathrooms: 3 }), unit({ id: "x", capacity: 2 })];
    expect(summarizeUnits(units, "WHOLE_PLACE")).toEqual({ guests: 8, bedrooms: 4, beds: 6, bathrooms: 3 });
  });

  it("is all zeros for a place with nothing to book", () => {
    expect(summarizeUnits([], "ROOMS")).toEqual({ guests: 0, bedrooms: 0, beds: 0, bathrooms: 0 });
  });
});

describe("lowestRateCents", () => {
  it("is the cheapest night, or null without units", () => {
    expect(lowestRateCents([unit({ baseRateCents: 9_000 }), unit({ id: "b", baseRateCents: 7_500 })])).toBe(
      7_500,
    );
    expect(lowestRateCents([])).toBeNull();
  });
});

describe("amenitiesOf", () => {
  it("lists each amenity once, in the order the screens list them, whatever order the rooms had", () => {
    const rooms = [unit({ amenities: ["view", "wifi"] }), unit({ id: "b", amenities: ["wifi", "parking"] })];
    expect(amenitiesOf(rooms)).toEqual(["wifi", "parking", "view"]);
  });

  it("drops anything that is not a known amenity", () => {
    expect(amenitiesOf([unit({ amenities: ["wifi", "helipad", ""] })])).toEqual(["wifi"]);
    expect(amenitiesOf([])).toEqual([]);
  });
});

describe("hasUniformRate", () => {
  it("is true when every night costs the same", () => {
    expect(hasUniformRate([{ rateCents: 9_000 }, { rateCents: 9_000 }])).toBe(true);
  });

  it("is false when a night has a special price, and for no nights at all", () => {
    expect(hasUniformRate([{ rateCents: 9_000 }, { rateCents: 15_000 }])).toBe(false);
    expect(hasUniformRate([])).toBe(false);
  });
});

describe("bookingHref", () => {
  it("carries the room, the guests and both dates to the book page", () => {
    expect(
      bookingHref("beit-cedar", {
        roomId: "r1",
        guests: 2,
        dates: { checkIn: "2026-11-14", checkOut: "2026-11-17" },
      }),
    ).toBe("/p/beit-cedar/book?room=r1&guests=2&checkIn=2026-11-14&checkOut=2026-11-17");
  });

  it("writes a slug and a room that need escaping safely, so a link cannot be bent into another address", () => {
    const href = bookingHref("a b/../c", {
      roomId: "x&guests=99",
      guests: 1,
      dates: { checkIn: "2026-11-14", checkOut: "2026-11-15" },
    });
    expect(href.startsWith("/p/a%20b%2F..%2Fc/book?")).toBe(true);
    expect(new URL(href, "http://x").searchParams.get("room")).toBe("x&guests=99");
    expect(new URL(href, "http://x").searchParams.get("guests")).toBe("1");
  });
});

describe("initialStay", () => {
  it("reads a well-formed address", () => {
    expect(initialStay({ room: "r1", checkIn: "2026-11-14", checkOut: "2026-11-17", guests: "3" })).toEqual({
      roomId: "r1",
      checkIn: "2026-11-14",
      checkOut: "2026-11-17",
      guests: 3,
    });
  });

  it("keeps nothing from an empty address", () => {
    expect(initialStay({})).toEqual({});
  });

  it("drops dates that are not dates, back to front, or only half there", () => {
    expect(initialStay({ checkIn: "soon", checkOut: "2026-11-17" })).toEqual({});
    expect(initialStay({ checkIn: "2026-02-31", checkOut: "2026-03-02" })).toEqual({});
    expect(initialStay({ checkIn: "2026-11-17", checkOut: "2026-11-14" })).toEqual({});
    expect(initialStay({ checkIn: "2026-11-17", checkOut: "2026-11-17" })).toEqual({});
    expect(initialStay({ checkIn: "2026-11-14" })).toEqual({});
  });

  it("drops guest counts that are not a whole number from 1 to 30", () => {
    for (const guests of ["0", "31", "-2", "2.5", "many", ""]) expect(initialStay({ guests })).toEqual({});
    expect(initialStay({ guests: "30" })).toEqual({ guests: 30 });
  });

  it("ignores a value given twice in the address, and a room name too long to be real", () => {
    expect(initialStay({ room: ["a", "b"], guests: ["2", "3"], checkIn: ["2026-11-14"] })).toEqual({});
    expect(initialStay({ room: "x".repeat(65) })).toEqual({});
  });
});

describe("stayHitsTakenNights", () => {
  const stay = { checkIn: "2026-11-14", checkOut: "2026-11-17" };

  it("is true when a night of the stay is taken", () => {
    expect(stayHitsTakenNights(stay, ["2026-11-15"])).toBe(true);
    expect(stayHitsTakenNights(stay, ["2026-11-14"])).toBe(true);
    expect(stayHitsTakenNights(stay, ["2026-11-16"])).toBe(true);
  });

  it("ignores the check-out night, which is free, and nights outside the stay", () => {
    expect(stayHitsTakenNights(stay, ["2026-11-17"])).toBe(false);
    expect(stayHitsTakenNights(stay, ["2026-11-13", "2026-11-20"])).toBe(false);
    expect(stayHitsTakenNights(stay, [])).toBe(false);
  });
});
