import type { BookingMode, BookingStatus } from "@prisma/client";
import { type OnlinePaymentMethod } from "@/config/enums";
import { recordSystemEvent } from "@/modules/audit/server";
import { lockSession } from "@/modules/offerings/server";
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
import { requireOwner, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction, type Tx } from "@/server/db/client";
import { appUrl } from "@/server/email/notices";
import { conflict, invalid, notFound, unavailable } from "@/server/errors";
import {
  type BookingKind,
  notifyBookingRequested,
  notifyBookingStatus,
  notifyHostsNewBooking,
  notifyLatePaymentRefunded,
} from "./booking-notifications";
import { amountDueOnline, holdUntil, sessionHoldUntil, statusWhenPaid } from "./booking-policy";
import * as bookings from "./booking-repository";
import * as payments from "./payment-repository";
import type { PaidFor } from "./payment-repository";
import * as sessionBookings from "./session-booking-repository";

// Guests paying online, always the full total, into Mabeet's Whish or Stripe account, and full refunds when a paid
// booking ends. A callback, the webhook or a returning guest only makes us ask Whish or Stripe: their answer
// decides, so a forged callback cannot confirm a booking. Our row is always written first, and the provider is
// called only after the commit; a refund the provider refuses stays owed and is sent by hand. Seats in a session are
// paid, settled and refunded the same way as a stay.

/** A payment still pending this long has probably lost its callback, so housekeeping asks the provider. */
const STALE_PAYMENT_AGE_MS = 2 * 60_000;
/** Past a day, a pending payment or an unsent refund is left to the admin's money page. */
const RETRY_WINDOW_MS = 24 * 60 * 60_000;
const BATCH_SIZE = 25;

/**
 * A booking's payments, for the owner: money is not a permission, so only an owner sees it (like plans and payouts).
 * Another place's booking is "not found".
 */
export async function listBookingPayments(ctx: TenantContext, bookingId: string) {
  requireOwner(ctx, "Only an owner can see a booking's payments");
  if (!(await bookings.findBooking(prisma, ctx.businessId, bookingId))) throw notFound("Booking");
  return payments.listPaymentsForBooking(prisma, ctx.businessId, bookingId);
}

/** Which ways this booking's guest can pay online, for their booking page. */
export function onlinePaymentMethods(currency: string): OnlinePaymentMethod[] {
  const methods: OnlinePaymentMethod[] = [];
  if (whishEnabled() && supportsWhish(currency)) methods.push("WHISH");
  if (stripeEnabled() && supportsCard(currency)) methods.push("CARD");
  return methods;
}

/** What a guest pays for, a stay or seats, as checkout reads it. */
interface Payable {
  id: string;
  kind: BookingKind;
  paidFor: PaidFor;
  businessId: string;
  status: BookingStatus;
  bookingMode: BookingMode;
  totalCents: number;
  currency: string;
  holdExpiresAt: Date | null;
  guestEmail: string | null;
  publicToken: string;
  /** What the payment page says it is for: the place, what was booked, the reference. */
  description: string;
  payments: ReadonlyArray<{ status: string }>;
}

/** The guest's own booking by its private link, a stay or seats. Null for anyone else. */
async function findPayable(token: string, guestUserId: string): Promise<Payable | null> {
  const stay = await bookings.findBookingByPublicToken(prisma, token, guestUserId);
  if (stay) {
    return {
      ...stay,
      kind: "stay",
      paidFor: { bookingId: stay.id },
      description: `${stay.business.name} · ${stay.room.name} · ${stay.reference}`,
    };
  }
  const seats = await sessionBookings.findSessionBookingByPublicToken(prisma, token, guestUserId);
  if (!seats) return null;
  return {
    ...seats,
    kind: "session",
    paidFor: { sessionBookingId: seats.id },
    description: `${seats.business.name} · ${seats.offering.title} · ${seats.reference}`,
  };
}

/** The guest pays their booking that waits for its payment. Returns the Whish or Stripe page to send them to. */
export async function startBookingCheckout(
  token: string,
  guestUserId: string,
  method: OnlinePaymentMethod,
  now = new Date(),
) {
  const booking = await findPayable(token, guestUserId);
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
    ...booking.paidFor,
    businessId: booking.businessId,
    amountCents: amount,
    currency: booking.currency,
    method: method === "WHISH" ? "WHISH" : "STRIPE",
  });
  const { description } = booking;
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

/** A booking as settling a payment reads it, under its lock: where it stands and where a payment takes it. */
interface Settling {
  id: string;
  status: BookingStatus;
  guestName: string;
  reference: string;
  /** Where the booking goes once paid, and until when it may then wait for the owner. */
  next: BookingStatus;
  holdExpiresAt: Date | null;
  /** Moves it from AWAITING_PAYMENT; null when it was no longer there. */
  move: () => Promise<unknown>;
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
  const paidFor = payment?.booking ?? payment?.sessionBooking;
  if (!payment || !paidFor) throw notFound("Payment");
  if (payment.status === "PAID" || payment.status === "REFUNDED") return "paid";
  const verdict = await verify(payment);
  if (!verdict.paid) {
    if (verdict.final) await payments.markFailed(prisma, payment.id);
    return verdict.final ? "failed" : "pending";
  }

  const kind: BookingKind = payment.booking ? "stay" : "session";
  const { businessId } = paidFor;
  const outcome = await runInTransaction(async (tx) => {
    const settling = payment.booking
      ? await settlingStay(tx, payment.booking, now)
      : payment.sessionBooking && (await settlingSeats(tx, payment.sessionBooking, now));
    const marked = await payments.markPaid(tx, payment.id, {
      paidAt: now,
      providerPaymentId: verdict.providerPaymentId,
      note: verdict.note,
    });
    if (!marked) return null;
    if (!settling) throw notFound("Booking");
    const ref: PaidFor = kind === "stay" ? { bookingId: settling.id } : { sessionBookingId: settling.id };
    const takes =
      settling.status === "AWAITING_PAYMENT" && !(await payments.hasOtherPaidPayment(tx, ref, payment.id));
    const moved = takes ? await settling.move() : null;
    await recordSystemEvent(tx, {
      businessId,
      action: moved ? "payment.online_confirmed" : "payment.online_late",
      entity: kind === "stay" ? "booking" : "session_booking",
      entityId: settling.id,
      note: { guest: settling.guestName, reference: settling.reference },
    });
    const refunds = moved
      ? []
      : await refundPayments(tx, ref, "Paid after the booking had ended or was already paid", [payment.id]);
    return { moved: Boolean(moved), next: settling.next, refunds };
  });
  if (!outcome) return "paid";

  if (outcome.moved && outcome.next === "CONFIRMED") {
    notifyBookingStatus(paidFor.id, kind);
    notifyHostsNewBooking(paidFor.id, kind);
  } else if (outcome.moved) {
    notifyBookingRequested(paidFor.id, kind);
  } else {
    await sendRefunds(outcome.refunds, now);
    notifyLatePaymentRefunded(paidFor.id, payment.id, kind);
  }
  return "paid";
}

/** A stay being paid for, with its room locked: in mode 2 it then waits the owner's answer time. */
async function settlingStay(
  tx: Tx,
  booking: { id: string; businessId: string; roomId: string; business: { holdHours: number } },
  now: Date,
): Promise<Settling | null> {
  await bookings.lockActiveRoom(tx, booking.businessId, booking.roomId);
  const current = await bookings.findBooking(tx, booking.businessId, booking.id);
  if (!current) return null;
  const next = statusWhenPaid(current.bookingMode);
  const holdExpiresAt = holdUntil(next, booking.business.holdHours, now);
  return {
    ...current,
    next,
    holdExpiresAt,
    move: () =>
      bookings.changeStatus(tx, booking.businessId, current.id, "AWAITING_PAYMENT", {
        status: next,
        holdExpiresAt,
      }),
  };
}

/** Seats being paid for, with their session locked: in mode 2 they then wait for the owner, never past the start. */
async function settlingSeats(
  tx: Tx,
  booking: { id: string; businessId: string; sessionId: string; business: { holdHours: number } },
  now: Date,
): Promise<Settling | null> {
  const session = await lockSession(tx, booking.businessId, booking.sessionId);
  const current = await sessionBookings.findSessionBooking(tx, booking.businessId, booking.id);
  if (!session || !current) return null;
  const next = statusWhenPaid(current.bookingMode);
  const holdExpiresAt = sessionHoldUntil(next, booking.business.holdHours, session.startsAt, now);
  return {
    ...current,
    next,
    holdExpiresAt,
    move: () =>
      sessionBookings.changeSessionStatus(tx, booking.businessId, current.id, "AWAITING_PAYMENT", {
        status: next,
        holdExpiresAt,
      }),
  };
}

/** The guest came back from Whish or Stripe: their pending payments are checked at once. */
export async function refreshGuestPayments(token: string, guestUserId: string, now = new Date()) {
  const booking = await findPayable(token, guestUserId);
  if (!booking) return;
  const pending = await payments.listPendingForBooking(prisma, booking.paidFor);
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
  paidFor: PaidFor,
  reason: string,
  only?: readonly string[],
): Promise<RefundToSend[]> {
  const paid = await payments.lockPaidPayments(tx, paidFor);
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
