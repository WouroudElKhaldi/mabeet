import { MAX_DAYS_AHEAD, MAX_STAY_NIGHTS, type StayIssue } from "@/config/booking-limits";
import { addDays, countNights, type DateRange, todayUtc } from "@/utils/dates";

// Whether a stay can be booked as asked. The same questions the booking engine asks when a booking is made, so the
// price shown before booking never promises what the booking would refuse. Pure, so it is easy to test.

interface StayCheck {
  range: DateRange;
  /** How many guests, when the guest has said. */
  guests: number | null;
  room: { capacity: number; minNights: number };
}

/** The first reason the stay cannot be booked, or null. */
export function stayIssue({ range, guests, room }: StayCheck, now: Date = new Date()): StayIssue | null {
  const today = todayUtc(now);
  const nights = countNights(range);
  if (range.checkIn < today) return "PAST";
  if (range.checkIn > addDays(today, MAX_DAYS_AHEAD)) return "TOO_FAR";
  if (nights > MAX_STAY_NIGHTS) return "TOO_LONG";
  if (nights < room.minNights) return "MIN_NIGHTS";
  if (guests !== null && guests > room.capacity) return "CAPACITY";
  return null;
}
