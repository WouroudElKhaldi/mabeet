import { describe, expect, it } from "vitest";
import { acceptsMessages, offersWhatsapp, responseSpeed, yearsHosting } from "../host";

// How a host is shown to guests: the ways to reach them follow their choice, and their figures read as words.

describe("reaching the host", () => {
  it("follows the host's choice", () => {
    const number = "+96171123456";
    expect([acceptsMessages("BOTH", number), offersWhatsapp("BOTH")]).toEqual([true, true]);
    expect([acceptsMessages("WHATSAPP", number), offersWhatsapp("WHATSAPP")]).toEqual([false, true]);
    expect([acceptsMessages("MESSAGE", number), offersWhatsapp("MESSAGE")]).toEqual([true, false]);
  });

  it("keeps Contact host open for WhatsApp only when the place has no number", () => {
    expect(acceptsMessages("WHATSAPP", null)).toBe(true);
    expect(acceptsMessages("WHATSAPP", "")).toBe(true);
  });
});

describe("how quickly a host answers", () => {
  it("reads as within an hour, a day or a few days, each limit included", () => {
    expect(responseSpeed(0)).toBe("withinHour");
    expect(responseSpeed(60)).toBe("withinHour");
    expect(responseSpeed(61)).toBe("withinDay");
    expect(responseSpeed(24 * 60)).toBe("withinDay");
    expect(responseSpeed(24 * 60 + 1)).toBe("withinDays");
  });
});

describe("years hosting", () => {
  const now = new Date("2026-11-09T12:00:00Z");

  it("counts full years from the year they started", () => {
    expect(yearsHosting(2019, now)).toBe(7);
    expect(yearsHosting(2025, now)).toBe(1);
  });

  it("is 0 for a host who started this year, and never negative for a year typed ahead", () => {
    expect(yearsHosting(2026, now)).toBe(0);
    expect(yearsHosting(2030, now)).toBe(0);
  });

  it("is unknown when the host did not say", () => {
    expect(yearsHosting(null, now)).toBeNull();
  });
});
