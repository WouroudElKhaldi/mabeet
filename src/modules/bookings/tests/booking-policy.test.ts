import { describe, expect, it } from "vitest";
import {
  amountDueOnline,
  holdUntil,
  initialStatus,
  PAYMENT_WINDOW_MINUTES,
  statusWhenPaid,
} from "../server/booking-policy";

const now = new Date("2026-11-01T10:00:00.000Z");

describe("where a booking goes in each mode", () => {
  it("waits for the online payment in modes 1 and 2, and for the owner offline", () => {
    expect(initialStatus("AUTOMATIC")).toBe("AWAITING_PAYMENT");
    expect(initialStatus("ONLINE_APPROVAL")).toBe("AWAITING_PAYMENT");
    expect(initialStatus("OFFLINE")).toBe("HELD");
  });

  it("is confirmed by the payment in mode 1, and goes to the owner in mode 2", () => {
    expect(statusWhenPaid("AUTOMATIC")).toBe("CONFIRMED");
    expect(statusWhenPaid("ONLINE_APPROVAL")).toBe("HELD");
  });
});

describe("how long a booking may wait", () => {
  it("gives the guest 10 minutes to pay", () => {
    expect(PAYMENT_WINDOW_MINUTES).toBe(10);
    expect(holdUntil("AWAITING_PAYMENT", 24, now)).toEqual(new Date("2026-11-01T10:10:00.000Z"));
  });

  it("gives the owner their own answer time", () => {
    expect(holdUntil("HELD", 24, now)).toEqual(new Date("2026-11-02T10:00:00.000Z"));
    expect(holdUntil("HELD", 6, now)).toEqual(new Date("2026-11-01T16:00:00.000Z"));
  });

  it("never runs out once confirmed or ended", () => {
    for (const status of ["CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"] as const) {
      expect(holdUntil(status, 24, now)).toBeNull();
    }
  });
});

describe("what is paid online", () => {
  it("is always the full total, with no deposit, and nothing offline", () => {
    expect(amountDueOnline("AUTOMATIC", 27_000)).toBe(27_000);
    expect(amountDueOnline("ONLINE_APPROVAL", 27_000)).toBe(27_000);
    expect(amountDueOnline("OFFLINE", 27_000)).toBeNull();
  });
});
