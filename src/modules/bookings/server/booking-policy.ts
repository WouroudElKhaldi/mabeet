import type { BookingMode, BookingStatus } from "@prisma/client";
import { isOnlineMode } from "@/config/enums";

// The business's booking mode, turned into what happens to one booking. Pure functions, so the rules that decide
// money and nights are easy to test and read in one place.
//
//   1. AUTOMATIC        AWAITING_PAYMENT (10 minutes) → CONFIRMED when paid
//   2. ONLINE_APPROVAL  AWAITING_PAYMENT (10 minutes) → HELD when paid → CONFIRMED or DECLINED by the owner
//   3. OFFLINE          HELD → CONFIRMED or DECLINED by the owner; the guest pays the owner directly

/** How long the room is held while the guest pays online. If no payment arrives in time, the nights are freed. */
export const PAYMENT_WINDOW_MINUTES = 10;

/** Where a new booking starts: waiting for the online payment, or (offline) waiting for the owner. */
export function initialStatus(mode: BookingMode): BookingStatus {
  return isOnlineMode(mode) ? "AWAITING_PAYMENT" : "HELD";
}

/** Where a booking goes once its online payment is confirmed: confirmed at once (mode 1), or to the owner (mode 2). */
export function statusWhenPaid(mode: BookingMode): BookingStatus {
  return mode === "AUTOMATIC" ? "CONFIRMED" : "HELD";
}

/**
 * How long a booking in this status may wait: the payment window while the guest pays, the owner's answer time
 * (`holdHours`) while the owner decides. A confirmed booking never runs out.
 */
export function holdUntil(status: BookingStatus, holdHours: number, now: Date): Date | null {
  if (status === "AWAITING_PAYMENT") return new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000);
  if (status === "HELD") return new Date(now.getTime() + holdHours * 3_600_000);
  return null;
}

/** What the guest pays online: always the full total, with no deposit. Null when they pay the owner directly. */
export function amountDueOnline(mode: BookingMode, totalCents: number): number | null {
  return isOnlineMode(mode) ? totalCents : null;
}
