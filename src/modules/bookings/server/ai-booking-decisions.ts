import type { PaymentMethod } from "@prisma/client";
import { recordAction } from "@/modules/audit/server";
import { getStripeAvailableCents, stripeEnabled } from "@/modules/payments/server";
import { isBusinessOwner, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { conflict, forbidden, invalid, notFound } from "@/server/errors";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { addDays, todayUtc, toIsoDate } from "@/utils/dates";
import { formatMoney } from "@/utils/format";
import * as bookings from "./booking-repository";
import { cancelBooking, confirmBooking, declineBooking } from "./booking-service";
import { moneyFreeForRefunds } from "./host-money-service";
import * as payments from "./payment-repository";

// Booking decisions asked for by a member's AI app (the host MCP), naming the booking by its reference. Each one runs
// the same service as the dashboard's button, under the member's own permissions. Confirming moves no money.
// Declining or cancelling a booking the guest paid online sends that money back, so an AI app may only do it after
// every check here passes, in this order:
//
//   1. Who: an owner of the place (staff end paid bookings from the dashboard).
//   2. When: the stay starts more than two days from now; anything closer is for the dashboard.
//   3. Asked twice: the first call only says what would happen. The second must repeat the exact refund.
//   4. The guest's money: paid online, in one currency, and not sent back already.
//   5. The host's money: what Mabeet still holds for this place covers the refund.
//   6. The company's money: what Mabeet holds for every place covers it, and for a card payment so does Mabeet's
//      Stripe balance. The host is never told these figures, only that the dashboard must be used.
//   7. A limit: a few such refunds a day per place.
//
// Every refusal is logged, so the owner (and Mabeet) can see what an AI app tried.

/** A paid stay starting sooner than this is ended from the dashboard, where the owner sees everything at once. */
const MIN_DAYS_BEFORE_CHECK_IN = 2;
/** How many paid bookings an AI app may end per place in a day. */
const AI_REFUNDS_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60_000;

const USE_THE_DASHBOARD =
  "This booking can't be ended from an AI app. Open it in your Mabeet dashboard, where you can decline or cancel it yourself.";

type Ending = "DECLINED" | "CANCELLED";

interface EndingRequest {
  reference: string;
  outcome: Ending;
  reason?: string;
  /** The refund exactly as the first call stated it ("$240.00"). Without it, nothing changes. */
  confirmRefund?: string;
}

/** What goes back to the guest: what they paid online and was not refunded yet. */
async function refundOwed(businessId: string, bookingId: string) {
  const paid = (await payments.listPaymentsForBooking(prisma, businessId, bookingId)).filter(
    (payment) => payment.status === "PAID" && payment.amountCents > payment.refundedCents,
  );
  if (paid.length === 0) return null;
  const currencies = new Set(paid.map((payment) => payment.currency));
  // One booking is paid in its place's currency; anything else is for a person to look at.
  const [currency] = currencies;
  if (currencies.size !== 1 || !currency) return { unusual: true as const };
  return {
    unusual: false as const,
    currency,
    amountCents: paid.reduce((total, payment) => total + payment.amountCents - payment.refundedCents, 0),
    methods: [...new Set(paid.map((payment) => payment.method))] as PaymentMethod[],
    cardCents: paid
      .filter((payment) => payment.method === "STRIPE")
      .reduce((total, payment) => total + payment.amountCents - payment.refundedCents, 0),
  };
}

/** Logs which check stopped the AI app (the action names it), then gives the member the one safe answer. */
async function refuse(
  ctx: TenantContext,
  booking: { id: string; guestName: string; reference: string },
  check: string,
): Promise<never> {
  await recordAction(ctx, `booking.ai_refund_refused.${check}`, "booking", booking.id, prisma, {
    guest: booking.guestName,
    reference: booking.reference,
  });
  throw forbidden(USE_THE_DASHBOARD);
}

/** An AI app confirms a booking waiting for the owner. */
export async function confirmBookingByReference(ctx: TenantContext, reference: string, now = new Date()) {
  requirePermission(ctx, "bookings.decide");
  const booking = await bookings.findBookingByReference(prisma, ctx.businessId, reference);
  if (!booking) throw notFound("Booking");
  const confirmed = await confirmBooking(ctx, { bookingId: booking.id }, now);
  return { reference: confirmed.reference, status: confirmed.status };
}

/**
 * An AI app declines or cancels a booking. One nobody paid online for ends at once (the AI app has already asked the
 * member). One with an online payment ends only after the checks above; until the refund is confirmed, the answer
 * is what would happen.
 */
export async function endBookingByReference(ctx: TenantContext, request: EndingRequest, now = new Date()) {
  requirePermission(ctx, "bookings.decide");
  const booking = await bookings.findBookingByReference(prisma, ctx.businessId, request.reference);
  if (!booking) throw notFound("Booking");
  const end = request.outcome === "DECLINED" ? declineBooking : cancelBooking;
  const decision = { bookingId: booking.id, reason: request.reason };

  const refund = await refundOwed(ctx.businessId, booking.id);
  if (!refund) {
    const ended = await end(ctx, decision, now);
    return { done: true as const, reference: ended.reference, status: ended.status, refund: null };
  }

  // 1. Who.
  if (!isBusinessOwner(ctx)) {
    throw forbidden("Only an owner can end a booking the guest paid online from an AI app.");
  }
  // 2. When.
  if (booking.checkIn < addDays(todayUtc(now), MIN_DAYS_BEFORE_CHECK_IN)) {
    return refuse(ctx, booking, "starts_soon");
  }
  // 4. The guest's money is something a refund can simply send back.
  if (refund.unusual) return refuse(ctx, booking, "payment");
  const amount = formatMoney(refund.amountCents, refund.currency, "en");

  // 3. Asked twice: the first answer is what would happen, and nothing changes.
  if (request.confirmRefund === undefined) {
    return {
      done: false as const,
      reference: booking.reference,
      guestName: { guestWritten: booking.guestName },
      checkIn: toIsoDate(booking.checkIn),
      checkOut: toIsoDate(booking.checkOut),
      status: booking.status,
      refund: amount,
      refundMethod: refund.methods,
      next: `This sends ${amount} back to the guest. Ask the member to confirm, then call again with confirmRefund set to exactly "${amount}".`,
    };
  }
  if (request.confirmRefund.trim() !== amount) {
    throw invalid(`The refund is ${amount}. Call again with confirmRefund set to exactly "${amount}".`);
  }

  // 5 and 6. The host's and the company's money.
  const free = await moneyFreeForRefunds(ctx.businessId, refund.currency, now);
  if (free.hostCents < refund.amountCents) return refuse(ctx, booking, "host_balance");
  if (free.platformCents < refund.amountCents) return refuse(ctx, booking, "platform_balance");
  if (refund.cardCents > 0) {
    if (!stripeEnabled()) return refuse(ctx, booking, "card_provider");
    const available = await getStripeAvailableCents(refund.currency).catch(() => null);
    if (available === null || available < refund.cardCents) return refuse(ctx, booking, "card_balance");
  }

  // 7. A few a day.
  try {
    await enforceRateLimit(`ai-refunds:${ctx.businessId}`, AI_REFUNDS_PER_DAY, DAY_MS);
  } catch {
    return refuse(ctx, booking, "daily_limit");
  }

  const ended = await end(ctx, decision, now);
  if (ended.status !== request.outcome) throw conflict("This booking just changed. Look at it again.");
  return { done: true as const, reference: ended.reference, status: ended.status, refund: amount };
}
