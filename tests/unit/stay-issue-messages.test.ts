import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import arLB from "../../messages/ar-LB.json";
import en from "../../messages/en.json";
import { STAY_ISSUES } from "@/config/booking-limits";

// The price check names why a stay cannot be booked as a code; the booking box turns each code into a sentence. A code
// with no sentence would show a guest a raw key, in the language they chose, so each one needs its text in all three.

describe("stay issues", () => {
  it.each([
    ["English", en],
    ["Arabic", ar],
    ["Lebanese Arabic", arLB],
  ])("have a sentence in %s", (_language, messages) => {
    const sentences = messages.booking.issues as Record<string, string>;
    for (const issue of STAY_ISSUES) expect(sentences[issue], issue).toMatch(/\S/);
    expect(Object.keys(sentences).sort()).toEqual([...STAY_ISSUES].sort());
  });
});
