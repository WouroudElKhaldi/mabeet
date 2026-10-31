import { describe, expect, it } from "vitest";
import { cents, id, isoDate, phone, stayDates } from "@/lib/schemas";

describe("shared input checks", () => {
  it("needs check-out after check-in, because the check-out night is free", () => {
    expect(stayDates.safeParse({ checkIn: "2026-11-12", checkOut: "2026-11-15" }).success).toBe(true);
    const sameDay = stayDates.safeParse({ checkIn: "2026-11-12", checkOut: "2026-11-12" });
    expect(sameDay.success).toBe(false);
    expect(sameDay.error?.issues[0]?.path).toEqual(["checkOut"]);
  });

  it("accepts only real calendar dates", () => {
    expect(isoDate.safeParse("2026-11-12").success).toBe(true);
    expect(isoDate.safeParse("2026-02-30").success).toBe(false);
    expect(isoDate.safeParse("12/11/2026").success).toBe(false);
  });

  it("wants phone numbers in international format", () => {
    expect(phone.safeParse("+96171123456").success).toBe(true);
    expect(phone.safeParse("71 123 456").success).toBe(false);
  });

  it("takes money only as whole minor units", () => {
    expect(cents.safeParse(14_000).success).toBe(true);
    expect(cents.safeParse(140.5).success).toBe(false);
    expect(cents.safeParse(-1).success).toBe(false);
  });

  it("takes an LBP night's price, and refuses an amount too large to hold exactly", () => {
    expect(cents.safeParse(450_000_000).success).toBe(true);
    expect(cents.safeParse(Number.MAX_SAFE_INTEGER + 2).success).toBe(false);
  });

  it("refuses empty or oversized ids", () => {
    expect(id.safeParse("").success).toBe(false);
    expect(id.safeParse("x".repeat(65)).success).toBe(false);
  });
});
