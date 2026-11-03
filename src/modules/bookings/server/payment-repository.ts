import type { Db, Tx } from "@/server/db/client";

// A booking's online payments and their refunds. Every payment is online (Whish or Stripe) and for the full total;
// what a guest pays the owner directly is between them and is never recorded here.

export function createOnlinePayment(
  db: Db,
  payment: {
    businessId: string;
    bookingId: string;
    amountCents: number;
    currency: string;
    method: "WHISH" | "STRIPE";
  },
) {
  return db.payment.create({ data: { ...payment, status: "PENDING" } });
}

/** Saves the checkout the guest was sent to: its provider reference (unique, so it is settled once) and its page. */
export function setCheckout(
  db: Db,
  paymentId: string,
  checkout: { providerRef: string; checkoutUrl: string },
) {
  return db.payment.update({ where: { id: paymentId }, data: checkout, select: { id: true } });
}

/** A payment to check with its provider, and the booking it pays for. */
export function findPaymentToSettle(db: Db, paymentId: string) {
  return db.payment.findFirst({
    where: { id: paymentId, bookingId: { not: null }, isDeleted: false },
    include: {
      booking: {
        select: { id: true, businessId: true, roomId: true, business: { select: { holdHours: true } } },
      },
    },
  });
}

/** Marks a payment paid, once: when callbacks, the webhook and the returning guest arrive together, one wins. */
export async function markPaid(
  tx: Tx,
  paymentId: string,
  paid: { paidAt: Date; providerPaymentId: string | null; note: string | null },
): Promise<boolean> {
  const { count } = await tx.payment.updateMany({
    where: { id: paymentId, status: { in: ["PENDING", "FAILED"] }, isDeleted: false },
    data: { status: "PAID", ...paid },
  });
  return count === 1;
}

/** The provider says the payment ran out unpaid. */
export async function markFailed(db: Db, paymentId: string): Promise<void> {
  await db.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "FAILED" } });
}

/** Whether another payment for the same booking was already paid (a guest who paid twice). */
export async function hasOtherPaidPayment(tx: Tx, bookingId: string, paymentId: string): Promise<boolean> {
  const count = await tx.payment.count({
    where: { bookingId, id: { not: paymentId }, status: "PAID", isDeleted: false },
  });
  return count > 0;
}

/** A booking's payments for its owner, oldest first: what was paid, how, and what went back. */
export function listPaymentsForBooking(db: Db, businessId: string, bookingId: string) {
  return db.payment.findMany({
    where: { businessId, bookingId, isDeleted: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      amountCents: true,
      refundedCents: true,
      currency: true,
      method: true,
      status: true,
      paidAt: true,
      createdAt: true,
    },
  });
}

export function listPendingForBooking(db: Db, bookingId: string) {
  return db.payment.findMany({
    where: { bookingId, status: "PENDING", isDeleted: false },
    select: { id: true },
  });
}

/** Payments still pending, started within the window: callbacks that may have been missed. */
export function listStalePending(db: Db, window: { from: Date; to: Date }, take: number) {
  return db.payment.findMany({
    where: {
      status: "PENDING",
      bookingId: { not: null },
      createdAt: { gte: window.from, lt: window.to },
      isDeleted: false,
    },
    orderBy: { createdAt: "asc" },
    take,
    select: { id: true },
  });
}

/**
 * Locks a booking's paid payments until the transaction ends and returns them, so two refunds (an owner's cancel
 * and the clock's expiry at the same moment) can never give back more than was paid.
 */
export async function lockPaidPayments(tx: Tx, bookingId: string) {
  await tx.$queryRaw`
    SELECT id FROM "Payment"
    WHERE "bookingId" = ${bookingId} AND status = 'PAID' AND NOT "isDeleted"
    FOR UPDATE`;
  return tx.payment.findMany({
    where: { bookingId, status: "PAID", isDeleted: false },
    select: {
      id: true,
      businessId: true,
      amountCents: true,
      refundedCents: true,
      currency: true,
      method: true,
      providerPaymentId: true,
    },
  });
}

/**
 * Records that a payment is owed back in full: a refund to send, and the payment marked refunded. The refund stays
 * PENDING until Whish or Stripe confirms it; one they refuse is sent by hand from the admin's money page.
 */
export async function recordFullRefund(
  tx: Tx,
  payment: { id: string; businessId: string; amountCents: number; refundedCents: number; currency: string },
  reason: string,
) {
  const refund = await tx.refund.create({
    data: {
      businessId: payment.businessId,
      paymentId: payment.id,
      amountCents: payment.amountCents - payment.refundedCents,
      currency: payment.currency,
      status: "PENDING",
      reason,
    },
    select: { id: true, amountCents: true },
  });
  await tx.payment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED", refundedCents: payment.amountCents },
  });
  return refund;
}

/** The provider confirmed the refund. Only a pending one changes, so a retry that also succeeded changes nothing. */
export async function markRefundDone(
  db: Db,
  refundId: string,
  providerRef: string,
  doneAt: Date,
): Promise<void> {
  await db.refund.updateMany({
    where: { id: refundId, status: "PENDING" },
    data: { status: "DONE", providerRef, doneAt },
  });
}

/** Refunds still owed that were recorded within the window, with how to send each one. */
export function listRefundsToSend(db: Db, window: { from: Date; to: Date }, take: number) {
  return db.refund.findMany({
    where: {
      status: "PENDING",
      providerRef: null,
      createdAt: { gte: window.from, lt: window.to },
      isDeleted: false,
      payment: { bookingId: { not: null } },
    },
    orderBy: { createdAt: "asc" },
    take,
    select: {
      id: true,
      amountCents: true,
      reason: true,
      payment: { select: { id: true, method: true, currency: true, providerPaymentId: true } },
    },
  });
}
