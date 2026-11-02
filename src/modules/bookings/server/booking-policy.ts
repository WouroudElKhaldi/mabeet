import type { BookingMode, BookingStatus } from "@prisma/client";
import { MAX_DAYS_AHEAD, MAX_STAY_NIGHTS, type StayIssue } from "@/config/booking-limits";
import { isOnlineMode } from "@/config/enums";
import { invalid } from "@/server/errors";
import { addDays, countNights, type DateRange, todayUtc } from "@/utils/dates";

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

// ---------- Which stays can be booked ----------

interface StayCheck {
  range: DateRange;
  /** How many guests, when known. */
  guests: number | null;
  /** The room's own limits. Without them, only the dates are checked. */
  room?: { capacity: number; minNights: number };
}

/**
 * The first reason a stay cannot be booked as asked, or null. The one rule for it: the booking engine refuses a
 * booking with it, and the public price quote shows it, so a price never promises what booking would refuse.
 */
export function stayIssue({ range, guests, room }: StayCheck, now: Date = new Date()): StayIssue | null {
  const today = todayUtc(now);
  const nights = countNights(range);
  if (range.checkIn < today) return "PAST";
  if (range.checkIn > addDays(today, MAX_DAYS_AHEAD)) return "TOO_FAR";
  if (nights > MAX_STAY_NIGHTS) return "TOO_LONG";
  if (room && nights < room.minNights) return "MIN_NIGHTS";
  if (room && guests !== null && guests > room.capacity) return "CAPACITY";
  return null;
}

/** Refuses a stay that cannot be booked as asked, in words the guest understands. */
export function assertBookableStay(check: StayCheck, now: Date): void {
  const issue = stayIssue(check, now);
  if (!issue) return;
  const { room } = check;
  const messages: Record<StayIssue, string> = {
    PAST: "Check-in cannot be in the past",
    TOO_FAR: "Those dates are too far ahead",
    TOO_LONG: `Stays are limited to ${MAX_STAY_NIGHTS} nights`,
    MIN_NIGHTS: `This room needs at least ${room?.minNights} nights`,
    CAPACITY: `This room sleeps up to ${room?.capacity}`,
  };
  throw invalid(messages[issue]);
}
