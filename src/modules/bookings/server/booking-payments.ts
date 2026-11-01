import { type OnlinePaymentMethod } from "@/config/enums";
import { recordSystemEvent } from "@/modules/audit/server";
import {
  createPaymentCheckout,
  createStripeRefund,
  createWhishPayment,
  getWhishStatus,
  refundWhishPayment,
  retrieveCheckoutSession,
  stripeEnabled,
  supportsCard,
  supportsWhish,
  whishEnabled,
} from "@/modules/payments/server";
import { prisma, runInTransaction, type Tx } from "@/server/db/client";
import { appUrl } from "@/server/email/notices";
import { conflict, invalid, notFound, unavailable } from "@/server/errors";
import {
  notifyBookingRequested,
  notifyBookingStatus,
  notifyHostsNewBooking,
  notifyLatePaymentRefunded,
} from "./booking-notifications";
import { amountDueOnline, holdUntil, statusWhenPaid } from "./booking-policy";
import * as bookings from "./booking-repository";
import * as payments from "./payment-repository";

// Guests paying online, always the full total, into Mabeet's Whish or Stripe account, and full refunds when a paid
// booking ends. A callback, the webhook or a returning guest only makes us ask Whish or Stripe: their answer
// decides, so a forged callback cannot confirm a booking. Our row is always written first, and the provider is
// called only after the commit; a refund the provider refuses stays owed and is sent by hand.

/** A payment still pending this long has probably lost its callback, so housekeeping asks the provider. */
const STALE_PAYMENT_AGE_MS = 2 * 60_000;
/** Past a day, a pending payment or an unsent refund is left to the admin's money page. */
const RETRY_WINDOW_MS = 24 * 60 * 60_000;
const BATCH_SIZE = 25;

/** Which ways this booking's guest can pay online, for their booking page. */
export function onlinePaymentMethods(currency: string): OnlinePaymentMethod[] {
  const methods: OnlinePaymentMethod[] = [];
  if (whishEnabled() && supportsWhish(currency)) methods.push("WHISH");
  if (stripeEnabled() && supportsCard(currency)) methods.push("CARD");
  return methods;
}

/** The guest pays their booking that waits for its payment. Returns the Whish or Stripe page to send them to. */
export async function startBookingCheckout(
  token: string,
  guestUserId: string,
  method: OnlinePaymentMethod,
  now = new Date(),
) {
  const booking = await bookings.findBookingByPublicToken(prisma, token, guestUserId);
  if (!booking) throw notFound("Booking");
  const amount = amountDueOnline(booking.bookingMode, booking.totalCents);
  if (booking.status !== "AWAITING_PAYMENT" || amount === null) {
    throw conflict("This booking has nothing to pay online right now.");
  }
  if (booking.holdExpiresAt && booking.holdExpiresAt <= now) {
    throw conflict("The time to pay has run out. Please book again.");
  }
  if (booking.payments.some((payment) => payment.status === "PAID")) {
    throw conflict("This booking is already paid.");
  }
  if (method === "CARD" ? !stripeEnabled() : !whishEnabled()) {
    throw unavailable(
      method === "WHISH" ? "Whish payments are not set up yet." : "Card payments are not set up yet.",
    );
  }
  if (!onlinePaymentMethods(booking.currency).includes(method)) {
    throw invalid(
      method === "WHISH" ? "Whish can't take this currency." : "Cards can't be used for this currency.",
    );
  }

  const payment = await payments.createOnlinePayment(prisma, {
    businessId: booking.businessId,
    bookingId: booking.id,
    amountCents: amount,
    currency: booking.currency,
    method: method === "WHISH" ? "WHISH" : "STRIPE",
  });
  const description = `${booking.business.name} · ${booking.room.name} · ${booking.reference}`;
  const back = appUrl(`/b/${booking.publicToken}?payment=${payment.id}`);

  if (method === "WHISH") {
    const url = await createWhishPayment({
      externalId: payment.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      invoice: description,
      successCallbackUrl: appUrl(`/api/payments/whish/callback?payment=${payment.id}`),
      failureCallbackUrl: appUrl(`/api/payments/whish/callback?payment=${payment.id}&attempt=failed`),
      successRedirectUrl: back,
      failureRedirectUrl: back,
    }).catch(async (error: unknown) => {
      await payments.markFailed(prisma, payment.id);
      throw error;
    });
    await payments.setCheckout(prisma, payment.id, { providerRef: `whish:${payment.id}`, checkoutUrl: url });
    return url;
  }

  const session = await createPaymentCheckout({
    paymentId: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    description,
    email: booking.guestEmail,
    successUrl: back,
    cancelUrl: appUrl(`/b/${booking.publicToken}`),
  }).catch(async (error: unknown) => {
    await payments.markFailed(prisma, payment.id);
    throw error;
  });
  await payments.setCheckout(prisma, payment.id, { providerRef: session.id, checkoutUrl: session.url });
  return session.url;
}

type Verdict =
  { paid: true; providerPaymentId: string | null; note: string | null } | { paid: false; final: boolean };

/** Asks Whish or Stripe what really happened to a payment. */
async function verify(payment: {
  id: string;
  method: string;
  currency: string;
  providerRef: string | null;
}): Promise<Verdict> {
  if (payment.method === "WHISH") {
    const { status, payerPhone } = await getWhishStatus(payment.id, payment.currency);
    if (status === "success") {
      return { paid: true, providerPaymentId: null, note: payerPhone && `Whish ${payerPhone}` };
    }
    return { paid: false, final: status === "failed" };
  }
  if (!payment.providerRef) return { paid: false, final: false };
  const session = await retrieveCheckoutSession(payment.providerRef);
  if (session.payment_status === "paid") {
    return { paid: true, providerPaymentId: session.payment_intent ?? null, note: null };
  }
  return { paid: false, final: false };
}

/**
 * Checks a payment with its provider and, once paid, moves the booking on in the same transaction: confirmed in
 * mode 1, to the owner in mode 2. Safe to call any number of times: only the first call that sees it paid changes
 * anything. A payment that lands after the booking ended, or on a booking already paid, is refunded in full.
 */
export async function settleOnlinePayment(
  paymentId: string,
  now = new Date(),
): Promise<"paid" | "pending" | "failed"> {
  const payment = await payments.findPaymentToSettle(prisma, paymentId);
  if (!payment?.booking) throw notFound("Payment");
  if (payment.status === "PAID" || payment.status === "REFUNDED") return "paid";
  const verdict = await verify(payment);
  if (!verdict.paid) {
    if (verdict.final) await payments.markFailed(prisma, payment.id);
    return verdict.final ? "failed" : "pending";
  }

  const { booking } = payment;
  const outcome = await runInTransaction(async (tx) => {
    await bookings.lockActiveRoom(tx, booking.businessId, booking.roomId);
    const marked = await payments.markPaid(tx, payment.id, {
      paidAt: now,
      providerPaymentId: verdict.providerPaymentId,
      note: verdict.note,
    });
    if (!marked) return null;
    const current = await bookings.findBooking(tx, booking.businessId, booking.id);
    if (!current) throw notFound("Booking");
    const next = statusWhenPaid(current.bookingMode);
    const takes =
      current.status === "AWAITING_PAYMENT" &&
      !(await payments.hasOtherPaidPayment(tx, current.id, payment.id));
    const moved = takes
      ? await bookings.changeStatus(tx, booking.businessId, current.id, "AWAITING_PAYMENT", {
          status: next,
          holdExpiresAt: holdUntil(next, booking.business.holdHours, now),
        })
      : null;
    await recordSystemEvent(tx, {
      businessId: booking.businessId,
      action: moved ? "payment.online_confirmed" : "payment.online_late",
      entity: "booking",
      entityId: current.id,
    });
    const refunds = moved
      ? []
      : await refundPayments(tx, current.id, "Paid after the booking had ended or was already paid", [
          payment.id,
        ]);
    return { moved: Boolean(moved), next, refunds };
  });
  if (!outcome) return "paid";

  if (outcome.moved && outcome.next === "CONFIRMED") {
    notifyBookingStatus(booking.id);
    notifyHostsNewBooking(booking.id);
  } else if (outcome.moved) {
    notifyBookingRequested(booking.id);
  } else {
    await sendRefunds(outcome.refunds, now);
    notifyLatePaymentRefunded(booking.id, payment.id);
  }
  return "paid";
}

/** The guest came back from Whish or Stripe: their pending payments are checked at once. */
export async function refreshGuestPayments(token: string, guestUserId: string, now = new Date()) {
  const booking = await bookings.findBookingByPublicToken(prisma, token, guestUserId);
  if (!booking) return;
  const pending = await payments.listPendingForBooking(prisma, booking.id);
  for (const payment of pending) {
    await settleOnlinePayment(payment.id, now).catch((error: unknown) =>
      console.error("[payments] check failed", error),
    );
  }
}

/** Housekeeping: re-checks payments still pending after a few minutes, in case a callback never arrived. */
export async function reconcilePendingPayments(now = new Date()) {
  const stale = await payments.listStalePending(
    prisma,
    { from: new Date(now.getTime() - RETRY_WINDOW_MS), to: new Date(now.getTime() - STALE_PAYMENT_AGE_MS) },
    BATCH_SIZE,
  );
  let paid = 0;
  for (const payment of stale) {
    const result = await settleOnlinePayment(payment.id, now).catch((error: unknown) => {
      console.error("[payments] check failed", error);
      return "pending";
    });
    if (result === "paid") paid += 1;
  }
  return { checked: stale.length, paid };
}

// ---------- Refunds: always the full amount ----------

export interface RefundToSend {
  refundId: string;
  amountCents: number;
  reason: string;
  payment: { id: string; method: string; currency: string; providerPaymentId: string | null };
}

/**
 * Inside the transaction that ends a booking (declined, cancelled, expired) or refuses a late payment: records a
 * full refund of every payment still held, and returns them to send once it commits. `only` limits it to these
 * payments. The payments are locked, so nothing is ever given back twice.
 */
export async function refundPayments(
  tx: Tx,
  bookingId: string,
  reason: string,
  only?: readonly string[],
): Promise<RefundToSend[]> {
  const paid = await payments.lockPaidPayments(tx, bookingId);
  const toSend: RefundToSend[] = [];
  for (const payment of paid) {
    if (only && !only.includes(payment.id)) continue;
    if (payment.amountCents - payment.refundedCents <= 0) continue;
    const refund = await payments.recordFullRefund(tx, payment, reason);
    toSend.push({ refundId: refund.id, amountCents: refund.amountCents, reason, payment });
  }
  return toSend;
}

/**
 * After the commit: asks Whish or Stripe to send each refund. One they refuse, or a card payment with no charge to
 * refund, stays owed: housekeeping tries again for a day, then it waits on the admin's money page. Both providers
 * refund a payment once, so trying again never pays twice.
 */
export async function sendRefunds(refunds: readonly RefundToSend[], now = new Date()): Promise<number> {
  let sent = 0;
  for (const refund of refunds) {
    try {
      if (refund.payment.method === "STRIPE") {
        if (!refund.payment.providerPaymentId) continue;
        const result = await createStripeRefund(
          refund.payment.providerPaymentId,
          refund.amountCents,
          refund.refundId,
        );
        await payments.markRefundDone(prisma, refund.refundId, result.id, now);
      } else {
        await refundWhishPayment(refund.payment.id, refund.payment.currency, refund.reason);
        await payments.markRefundDone(prisma, refund.refundId, `whish:${refund.payment.id}`, now);
      }
      sent += 1;
    } catch (error) {
      console.error("[payments] automatic refund failed", error);
    }
  }
  return sent;
}

/** Housekeeping: sends again the refunds still owed from the last day. */
export async function retryPendingRefunds(now = new Date()) {
  const owed = await payments.listRefundsToSend(
    prisma,
    { from: new Date(now.getTime() - RETRY_WINDOW_MS), to: now },
    BATCH_SIZE,
  );
  const sent = await sendRefunds(
    owed.map((refund) => ({
      refundId: refund.id,
      amountCents: refund.amountCents,
      reason: refund.reason,
      payment: refund.payment,
    })),
    now,
  );
  return { owed: owed.length, sent };
}
