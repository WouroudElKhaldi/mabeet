import type { BookingStatus } from "@prisma/client";
import { conflict } from "@/server/errors";

// Which status changes a booking may make. Anything else is refused with a 409, so a booking can never reach an
// impossible state (a declined booking confirmed, a confirmed one back to waiting).

const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  // Waiting for the owner: they confirm or decline, the time runs out, or the guest cancels.
  HELD: ["CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"],
  // Waiting for the online payment: paid (to the owner in mode 2, confirmed in mode 1), never paid, or cancelled.
  AWAITING_PAYMENT: ["HELD", "CONFIRMED", "EXPIRED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  DECLINED: [],
  EXPIRED: [],
  CANCELLED: [],
};

/** How a status reads inside an error message. */
const word = (status: BookingStatus) =>
  status === "AWAITING_PAYMENT" ? "waiting for payment" : status.toLowerCase();

function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) throw conflict(`A ${word(from)} booking cannot become ${word(to)}`);
}

/**
 * The owner confirms or declines only a booking that waits for them. One still waiting for the guest's online
 * payment is the payment's to decide: it is confirmed (mode 1) or sent to the owner (mode 2) once paid.
 */
export function assertOwnerCanAnswer(status: BookingStatus): void {
  if (status === "AWAITING_PAYMENT") {
    throw conflict("This booking is waiting for the guest's online payment. You can answer once it is paid.");
  }
}
