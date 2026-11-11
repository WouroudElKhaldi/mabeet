import { type Db, moneyNumber, type Tx } from "@/server/db/client";

// A booking's online payments and their refunds. Every payment is online (Whish or Stripe) and for the full total;
// what a guest pays the owner directly is between them and is never recorded here. A payment is for a stay
// (`bookingId`) or for seats in a session (`sessionBookingId`), never both: a CHECK in the migration says so.

/** What a payment is for, written as the payment's own column, so it can go straight into a query. */
export type PaidFor = { bookingId: string } | { sessionBookingId: string };

/** The two columns of a PaidFor, the other one null: for raw SQL, where a null never matches. */
const columnsOf = (paidFor: PaidFor) => ({
  bookingId: "bookingId" in paidFor ? paidFor.bookingId : null,
  sessionBookingId: "sessionBookingId" in paidFor ? paidFor.sessionBookingId : null,
});

/** Who a payment came from, and the booking's reference, whether it paid for a stay or for seats. */
const payer = { select: { reference: true, guestName: true } } as const;

export function createOnlinePayment(
  db: Db,
  payment: PaidFor & {
    businessId: string;
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

/** A payment to check with its provider, and the stay or the seats it pays for. */
export function findPaymentToSettle(db: Db, paymentId: string) {
  return db.payment.findFirst({
    where: { id: paymentId, isDeleted: false },
    include: {
      booking: {
        select: { id: true, businessId: true, roomId: true, business: { select: { holdHours: true } } },
      },
      sessionBooking: {
        select: { id: true, businessId: true, sessionId: true, business: { select: { holdHours: true } } },
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
export async function hasOtherPaidPayment(tx: Tx, paidFor: PaidFor, paymentId: string): Promise<boolean> {
  const count = await tx.payment.count({
    where: { ...paidFor, id: { not: paymentId }, status: "PAID", isDeleted: false },
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

export function listPendingForBooking(db: Db, paidFor: PaidFor) {
  return db.payment.findMany({
    where: { ...paidFor, status: "PENDING", isDeleted: false },
    select: { id: true },
  });
}

/** Payments still pending, started within the window: callbacks that may have been missed. */
export function listStalePending(db: Db, window: { from: Date; to: Date }, take: number) {
  return db.payment.findMany({
    where: {
      status: "PENDING",
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
export async function lockPaidPayments(tx: Tx, paidFor: PaidFor) {
  const { bookingId, sessionBookingId } = columnsOf(paidFor);
  await tx.$queryRaw`
    SELECT id FROM "Payment"
    WHERE ("bookingId" = ${bookingId} OR "sessionBookingId" = ${sessionBookingId})
      AND status = 'PAID' AND NOT "isDeleted"
    FOR UPDATE`;
  return tx.payment.findMany({
    where: { ...paidFor, status: "PAID", isDeleted: false },
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

// ---------- What Mabeet holds for hosts ----------

/**
 * What guests paid online, net of refunds, per business and currency: `earned` for confirmed stays and sessions that
 * have started (the only money a payout may release, so a refund never gives back money already paid out),
 * `upcoming` for the rest. A session has started once its day has come, as a stay has on its check-in day.
 * `businessId` null reads every business.
 */
export async function sumHeldMoney(db: Db, businessId: string | null, today: Date) {
  const rows = await db.$queryRaw<
    Array<{ businessId: string; currency: string; earned: bigint; upcoming: bigint }>
  >`
    SELECT p."businessId", p.currency,
           COALESCE(SUM(p."amountCents" - p."refundedCents") FILTER (WHERE s.started), 0)::bigint AS earned,
           COALESCE(SUM(p."amountCents" - p."refundedCents") FILTER (WHERE NOT s.started), 0)::bigint AS upcoming
    FROM "Payment" p
    LEFT JOIN "Booking" b ON b.id = p."bookingId"
    LEFT JOIN "SessionBooking" sb ON sb.id = p."sessionBookingId"
    LEFT JOIN "OfferingSession" os ON os.id = sb."sessionId"
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        (b.status = 'CONFIRMED' AND b."checkIn" <= ${today}::date)
          OR (sb.status = 'CONFIRMED' AND os."startsAt" < ${today}::date + 1),
        false) AS started
    ) s
    WHERE NOT p."isDeleted" AND p.status IN ('PAID', 'REFUNDED')
      AND (${businessId}::text IS NULL OR p."businessId" = ${businessId})
    GROUP BY 1, 2`;
  return rows.map((row) => ({
    businessId: row.businessId,
    currency: row.currency,
    earnedCents: moneyNumber(row.earned),
    upcomingCents: moneyNumber(row.upcoming),
  }));
}

/** A business's online payments, the latest first, with the stay or the seats each paid for. */
export function listBusinessPayments(db: Db, businessId: string, take: number) {
  return db.payment.findMany({
    where: { businessId, isDeleted: false, status: { in: ["PAID", "REFUNDED"] } },
    orderBy: { paidAt: "desc" },
    take,
    select: {
      id: true,
      amountCents: true,
      refundedCents: true,
      currency: true,
      method: true,
      status: true,
      paidAt: true,
      booking: payer,
      sessionBooking: payer,
    },
  });
}

/** Refunds a provider kept refusing and housekeeping stopped retrying: the admin sends them by hand. */
export function listRefundsToSendByHand(db: Db, recordedBefore: Date) {
  return db.refund.findMany({
    where: { status: "PENDING", isDeleted: false, createdAt: { lt: recordedBefore } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      businessId: true,
      amountCents: true,
      currency: true,
      reason: true,
      createdAt: true,
      business: { select: { name: true } },
      payment: {
        select: {
          method: true,
          booking: { select: { ...payer.select, guestPhone: true, guestEmail: true } },
          sessionBooking: { select: { ...payer.select, guestPhone: true, guestEmail: true } },
        },
      },
    },
  });
}

/** The admin sent a refund by hand. Only a pending one changes, so it is marked once. */
export async function markRefundSentByHand(
  db: Db,
  refundId: string,
  sent: { doneById: string; providerRef: string | null; doneAt: Date },
) {
  const [refund] = await db.refund.updateManyAndReturn({
    where: { id: refundId, status: "PENDING", isDeleted: false },
    data: { status: "DONE", ...sent },
    select: { id: true, businessId: true },
  });
  return refund ?? null;
}
