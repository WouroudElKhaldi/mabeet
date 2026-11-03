import type { BookingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { BOOKING_STATUSES } from "@/config/enums";
import { assertOwnerCanAnswer, assertTransition } from "../server/booking-status";

const allowed = (from: BookingStatus, to: BookingStatus) => {
  try {
    assertTransition(from, to);
    return true;
  } catch {
    return false;
  }
};

describe("booking status changes", () => {
  it("lets the owner decide, the clock expire and the guest cancel a booking waiting for the owner", () => {
    for (const to of ["CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"] as const) {
      expect(allowed("HELD", to)).toBe(true);
    }
  });

  it("lets a payment confirm a booking (mode 1) or send it to the owner (mode 2), or lets it run out", () => {
    for (const to of ["HELD", "CONFIRMED", "EXPIRED", "CANCELLED"] as const) {
      expect(allowed("AWAITING_PAYMENT", to)).toBe(true);
    }
    expect(allowed("AWAITING_PAYMENT", "DECLINED")).toBe(false);
  });

  it("never takes a confirmed booking back, only cancels it", () => {
    expect(allowed("CONFIRMED", "CANCELLED")).toBe(true);
    for (const to of ["HELD", "AWAITING_PAYMENT", "DECLINED", "EXPIRED"] as const) {
      expect(allowed("CONFIRMED", to)).toBe(false);
    }
  });

  it("keeps declined, expired and cancelled bookings final", () => {
    for (const from of ["DECLINED", "EXPIRED", "CANCELLED"] as const) {
      for (const to of BOOKING_STATUSES) expect(allowed(from, to)).toBe(false);
    }
  });

  it("refuses with a message people understand", () => {
    expect(() => assertTransition("DECLINED", "CONFIRMED")).toThrow(
      "A declined booking cannot become confirmed",
    );
    expect(() => assertTransition("CONFIRMED", "AWAITING_PAYMENT")).toThrow(
      "A confirmed booking cannot become waiting for payment",
    );
  });

  it("leaves a booking waiting for the online payment to the payment, not the owner", () => {
    expect(() => assertOwnerCanAnswer("AWAITING_PAYMENT")).toThrow(/waiting for the guest's online payment/);
    expect(() => assertOwnerCanAnswer("HELD")).not.toThrow();
  });
});
