import type { BookingMode, BookingStatus } from "@prisma/client";

// Where a booking stands, in the words of the step bar on the guest's booking page. Pure, so what the guest is told
// is easy to check against the booking engine's own rules (booking-policy.ts).

export type StepKey = "requested" | "paid" | "confirmed";

/**
 * The steps this booking goes through, and the one it is on now. Online and confirmed at once: sent, paid. Online and
 * confirmed by the host: sent, paid, confirmed. Offline: sent, confirmed. A booking that ended (declined, expired,
 * cancelled) has no steps left to show.
 */
export function bookingProgress(
  mode: BookingMode,
  status: BookingStatus,
): { steps: StepKey[]; current: number } | null {
  if (status === "DECLINED" || status === "EXPIRED" || status === "CANCELLED") return null;
  if (mode === "AUTOMATIC") return { steps: ["requested", "paid"], current: 1 };
  if (mode === "ONLINE_APPROVAL") {
    return { steps: ["requested", "paid", "confirmed"], current: status === "AWAITING_PAYMENT" ? 1 : 2 };
  }
  return { steps: ["requested", "confirmed"], current: 1 };
}

/** Whether the guest may still cancel: not yet over, and before the check-in day (as the engine checks it). */
export function canGuestCancel(status: BookingStatus, checkIn: string, today: string): boolean {
  return (status === "HELD" || status === "AWAITING_PAYMENT" || status === "CONFIRMED") && checkIn > today;
}

/**
 * How often the page asks again, in seconds, while the booking waits for something outside it (the payment page,
 * the host); null once nothing more can change without the guest.
 */
export function watchEverySeconds(mode: BookingMode, status: BookingStatus): number | null {
  if (status === "AWAITING_PAYMENT") return 4;
  if (status === "HELD") return mode === "OFFLINE" ? 30 : 15;
  return null;
}
