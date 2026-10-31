import { describe, expect, it } from "vitest";
import { bookingReference, REFERENCE_ALPHABET, secureToken } from "@/utils/tokens";

describe("tokens", () => {
  it("makes booking references a guest can read out on the phone", () => {
    const reference = bookingReference();
    expect(reference).toMatch(/^MB-[A-Z2-9]{6}$/);
    // No letters or digits that look alike (0 and O, 1, I and L).
    for (const character of reference.slice(3)) expect(REFERENCE_ALPHABET).toContain(character);
    expect(REFERENCE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("makes long, URL-safe secret links that never repeat", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => secureToken()));
    expect(tokens.size).toBe(100);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
