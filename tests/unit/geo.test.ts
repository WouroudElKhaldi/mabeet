import { describe, expect, it } from "vitest";
import { distanceKm, mapPin } from "@/utils/geo";

// "Nearest first" lists sort by these distances, so they must be right and never NaN.

describe("distanceKm", () => {
  it("is zero from a pin to itself, the same both ways, and right for a known trip", () => {
    const beirut = { latitude: 33.8938, longitude: 35.5018 };
    const tripoli = { latitude: 34.4367, longitude: 35.8497 };
    expect(distanceKm(beirut, beirut)).toBe(0);
    expect(distanceKm(beirut, tripoli)).toBeCloseTo(distanceKm(tripoli, beirut), 10);
    // Beirut to Tripoli is about 69 km as the crow flies.
    expect(distanceKm(beirut, tripoli)).toBeGreaterThan(67);
    expect(distanceKm(beirut, tripoli)).toBeLessThan(71);
  });

  it("stays a number for pins on opposite sides of the earth", () => {
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })).toBeCloseTo(
      20_015,
      -1,
    );
  });
});

describe("mapPin", () => {
  it("is a pin only when both halves are known", () => {
    expect(mapPin(33.9, 35.5)).toEqual({ latitude: 33.9, longitude: 35.5 });
    expect(mapPin(33.9, null)).toBeNull();
    expect(mapPin(null, 35.5)).toBeNull();
    expect(mapPin(0, 0)).toEqual({ latitude: 0, longitude: 0 });
  });
});
