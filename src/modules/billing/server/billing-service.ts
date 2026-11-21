import type { BookingUnit, Plan } from "@prisma/client";
import {
  PAID_PLANS,
  type PaidPlan,
  type PlanFeature,
  PLAN_LIMITS,
  PLAN_MONTH_MS,
  type PlanPaymentMethod,
  smallestPlanWith,
} from "@/config/plans";
import { findAccountEmail } from "@/modules/accounts/server";
import { settleOnlinePayment } from "@/modules/bookings/server";
import { recordAction } from "@/modules/audit/server";
import {
  createBillingPortalSession,
  createPlanCoupon,
  createSubscriptionCheckout,
  createWhishPayment,
  getWhishStatus,
  type StripeEvent,
  stripeEnabled,
  stripeEvent,
  verifyWebhookSignature,
  whishEnabled,
} from "@/modules/payments/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { type Db, prisma, runInTransaction, type Tx } from "@/server/db/client";
import { env } from "@/server/env";
import { conflict, forbidden, invalid, notFound, unavailable } from "@/server/errors";
import { secureToken } from "@/utils/tokens";
import * as billing from "./billing-repository";
import { bestDiscountFor, openOffersFor } from "./offer-service";
import * as planPayments from "./plan-payment-repository";

// Host plans: what each allows, paying by card through Stripe (a subscription) or by Whish (a month at a time),
// and Stripe's webhooks keeping the plan true. Plans are always paid instantly: nothing is paid by hand and
// nothing waits for an admin. Plan payments are Mabeet's revenue.

/** A Whish plan payment still pending this long has probably lost its callback, so housekeeping asks Whish. */
const STALE_PLAN_PAYMENT_AGE_MS = 2 * 60_000;
/** Past a day, a Whish link has long run out: housekeeping stops asking about it. */
const PLAN_PAYMENT_CHECK_WINDOW_MS = 24 * 60 * 60_000;
const HOUSEKEEPING_BATCH_SIZE = 25;

type Counted = "rooms" | "offerings" | "members";

/** Each paid plan's Stripe price; checkout is off until all of them are set. */
const priceFor = (plan: PaidPlan) =>
  ({
    STARTER: env.STRIPE_PRICE_STARTER,
    PRO: env.STRIPE_PRICE_PRO,
    BUSINESS: env.STRIPE_PRICE_BUSINESS,
    PREMIUM: env.STRIPE_PRICE_PREMIUM,
  })[plan];

const FEATURE_NAMES: Record<PlanFeature, string> = {
  analytics: "the Analytics page",
  mcp: "connecting AI apps",
};

const LIMIT_MESSAGES: Record<Counted, (max: number) => string> = {
  rooms: (max) =>
    max === 1
      ? "Your plan allows 1 room. Upgrade to add more."
      : `Your plan allows up to ${max} rooms. Upgrade to add more.`,
  offerings: (max) =>
    max === 1
      ? "Your plan allows 1 experience or service. Upgrade to add more."
      : `Your plan allows up to ${max} experiences or services. Upgrade to add more.`,
  members: (max) =>
    max === 1
      ? "Your plan is for you alone. Upgrade to add team members."
      : `Your plan allows up to ${max} team members, you included. Upgrade to add more.`,
};

/** The host whose plan covers a place. */
async function placeHost(businessId: string, db: Db = prisma) {
  const place = await billing.findPlaceHost(db, businessId);
  if (!place) throw notFound("Business");
  return place;
}

/**
 * Refuses adding one more room, experience or team member past the host's plan, counted across all their places.
 * A room added to a place booked whole uses nothing more (the place counts as one room), and neither does a person
 * who already works in another of the host's places (pass their `userId`). Pass the transaction that adds it: the
 * host's plan is then locked until it commits, so two additions at the same moment cannot both pass the check.
 */
export async function assertPlanAllowsAnother(
  businessId: string,
  what: Counted,
  tx?: Tx,
  options: { userId?: string } = {},
): Promise<void> {
  const db = tx ?? prisma;
  const place = await placeHost(businessId, db);
  if (what === "rooms" && place.bookingUnit === "WHOLE_PLACE") return;
  if (tx) await billing.lockHostPlan(tx, place.hostId);
  if (what === "members" && options.userId && (await billing.isOnHostTeam(db, place.hostId, options.userId)))
    return;
  const { plan } = await billing.findHostPlan(db, place.hostId);
  const max = PLAN_LIMITS[plan][what];
  const used = (await billing.countHostUsage(db, place.hostId))[what];
  if (max !== null && used >= max) throw conflict(LIMIT_MESSAGES[what](max));
}

/**
 * Refuses switching a place to being booked whole or by room when the host's plan has no room for it: by room, its
 * rooms count one by one instead of as one. Run in the transaction that switches it, which then holds the plan.
 */
export async function assertPlanAllowsBookingUnit(
  tx: Tx,
  businessId: string,
  bookingUnit: BookingUnit,
): Promise<void> {
  const place = await placeHost(businessId, tx);
  if (place.bookingUnit === bookingUnit) return;
  await billing.lockHostPlan(tx, place.hostId);
  const roomsInPlace = await billing.countPlaceRooms(tx, businessId);
  const { plan } = await billing.findHostPlan(tx, place.hostId);
  const max = PLAN_LIMITS[plan].rooms;
  if (max === null) return;
  const used = (await billing.countHostUsage(tx, place.hostId)).rooms;
  const after = bookingUnit === "WHOLE_PLACE" ? used - roomsInPlace + 1 : used - 1 + roomsInPlace;
  if (after > max) throw conflict(LIMIT_MESSAGES.rooms(max));
}

/** Whether the plan covering the place includes a feature that only some plans have (analytics, AI apps). */
export async function planIncludes(businessId: string, feature: PlanFeature): Promise<boolean> {
  const place = await placeHost(businessId);
  const { plan } = await billing.findHostPlan(prisma, place.hostId);
  return PLAN_LIMITS[plan][feature];
}

/** Refuses a feature the place's plan doesn't include, naming the smallest plan that does. */
export async function assertPlanIncludes(businessId: string, feature: PlanFeature): Promise<void> {
  if (await planIncludes(businessId, feature)) return;
  const plan = smallestPlanWith(feature);
  throw forbidden(
    `Your plan doesn't include ${FEATURE_NAMES[feature]}. Upgrade to ${plan.charAt(0)}${plan.slice(1).toLowerCase()} or higher.`,
  );
}

/** Each host's plan, for the admin: when it ends and whether it is paid by card. A host with no row is on Free. */
export async function getHostPlans(hostIds: string[]) {
  const rows = await billing.findHostPlans(prisma, hostIds);
  const found = new Map(rows.map((row) => [row.userId, row]));
  return new Map(
    hostIds.map((hostId) => {
      const row = found.get(hostId);
      return [
        hostId,
        {
          plan: row?.plan ?? ("FREE" as const satisfies Plan),
          renewsAt: row?.planRenewsAt ?? null,
          paysByCard: Boolean(row?.stripeSubscriptionId),
        },
      ];
    }),
  );
}

/**
 * The plan of a person who already hosts places, or null for a new host. A new place joins it: one plan covers all
 * of a host's places, so opening another is never a second plan to pick or pay for.
 */
export async function findHostPlanOf(userId: string) {
  const places = await billing.listHostedPlaces(prisma, userId);
  if (places.length === 0) return null;
  return (await billing.findHostPlan(prisma, userId)).plan;
}

/**
 * Which ways to pay for a plan are on. Public: a future host sees them before their business exists, so the
 * sign-up page offers only what works.
 */
export function planPaymentMethods(): Record<PlanPaymentMethod, boolean> {
  return {
    card: stripeEnabled() && PAID_PLANS.every((plan) => Boolean(priceFor(plan))),
    whish: whishEnabled(),
  };
}

/** For the billing page: the plan, what is used against it, which ways to pay are on, and the offers open to it. */
export async function getBilling(ctx: TenantContext, now = new Date()) {
  requirePermission(ctx, "settings.manage");
  const { hostId } = await placeHost(ctx.businessId);
  const [row, usage, places, joinedAt] = await Promise.all([
    billing.findHostPlan(prisma, hostId),
    billing.countHostUsage(prisma, hostId),
    billing.listHostedPlaces(prisma, hostId),
    billing.findHostJoinedAt(prisma, hostId),
  ]);
  const methods = planPaymentMethods();
  const offers = await openOffersFor(hostId, joinedAt ?? now, now);
  return {
    offers: offers.map((offer) => ({
      id: offer.id,
      name: offer.name,
      plan: offer.plan,
      kind: offer.kind,
      percentOff: offer.percentOff,
      until: offer.until,
      monthlyCents: offer.monthlyCents,
    })),
    plan: row.plan,
    limits: PLAN_LIMITS[row.plan],
    usage,
    places,
    renewsAt: row.planRenewsAt,
    paysByCard: Boolean(row.stripeSubscriptionId),
    cardEnabled: methods.card,
    whishEnabled: methods.whish,
    canManage: ctx.userId === hostId,
  };
}

/** The plan is the host's: only they change it or pay for it, for all their places at once. */
async function requireHost(ctx: TenantContext) {
  const { hostId } = await placeHost(ctx.businessId);
  if (ctx.userId !== hostId) throw forbidden("Only the host who owns this place can change the plan");
  const [row, joinedAt] = await Promise.all([
    billing.findHostPlan(prisma, hostId),
    billing.findHostJoinedAt(prisma, hostId),
  ]);
  return { hostId, row, joinedAt: joinedAt ?? new Date(0) };
}

function planForPrice(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return PAID_PLANS.find((plan) => priceFor(plan) === priceId) ?? null;
}

const billingUrl = (businessId: string, query = "") =>
  new URL(`/dashboard/${businessId}/billing${query}`, env.BETTER_AUTH_URL).toString();

/** Months left of an offer, rounded up: the months a card coupon takes the share off. */
const monthsLeft = (until: Date, now: Date) =>
  Math.max(1, Math.ceil((until.getTime() - now.getTime()) / PLAN_MONTH_MS));

/**
 * Returns the Stripe Checkout page to send the owner to. The plan starts when Stripe's webhook confirms it. Under a
 * percent-off offer, a one-use coupon takes the share off each invoice for the months the offer has left.
 */
export async function startCheckout(ctx: TenantContext, plan: PaidPlan, now = new Date()) {
  const priceId = priceFor(plan);
  if (!stripeEnabled() || !priceId) throw unavailable("Card payments are not set up yet.");
  const { hostId, row, joinedAt } = await requireHost(ctx);
  // A paying host changes plan in the billing portal, so it never ends up with two subscriptions.
  if (row.stripeSubscriptionId)
    throw conflict("You already pay by card. Change your plan from Manage billing.");
  const discount = await bestDiscountFor(hostId, joinedAt, plan, now);
  const couponId =
    discount && discount.percentOff !== null
      ? await createPlanCoupon({
          percentOff: discount.percentOff,
          months: monthsLeft(discount.until, now),
          name: discount.name,
        })
      : undefined;
  const session = await createSubscriptionCheckout({
    couponId,
    priceId,
    hostId,
    customerId: row.stripeCustomerId,
    email: (await findAccountEmail(ctx.userId)) ?? "",
    successUrl: billingUrl(ctx.businessId, "?checkout=done"),
    cancelUrl: billingUrl(ctx.businessId),
  });
  await recordAction(ctx, "billing.checkout_started", "business", ctx.businessId);
  return session.url;
}

/**
 * Pays one month of a plan with Whish. Whish has no subscriptions, so each payment adds a month; when the month
 * runs out without a new payment, the host goes back to Free. Our row is written first and Whish is called
 * after: if Whish refuses, the row is marked failed, so no payment is left waiting for a link that never existed.
 */
export async function startWhishPlanCheckout(ctx: TenantContext, plan: PaidPlan, now = new Date()) {
  if (!whishEnabled()) throw unavailable("Whish payments are not set up yet.");
  const { hostId, row, joinedAt } = await requireHost(ctx);
  if (row.stripeSubscriptionId) throw conflict("You pay by card. Change your plan from Manage billing.");
  // A percent-off offer open now lowers this month's price, and the payment remembers it.
  const discount = await bestDiscountFor(hostId, joinedAt, plan, now);
  const payment = await planPayments.createPlanPayment(prisma, {
    hostId,
    paidById: ctx.userId,
    plan,
    months: 1,
    offerId: discount?.id,
    amountCents: discount ? discount.monthlyCents : PLAN_LIMITS[plan].monthlyUsd * 100,
    currency: "USD",
    method: "WHISH",
    providerRef: `whish-plan:${secureToken()}`,
    status: "PENDING",
  });
  const callback = new URL(`/api/payments/whish/callback?plan=${payment.id}`, env.BETTER_AUTH_URL).toString();
  const url = await createWhishPayment({
    externalId: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    invoice: `Mabeet ${plan} plan, one month`,
    successCallbackUrl: callback,
    failureCallbackUrl: `${callback}&attempt=failed`,
    successRedirectUrl: billingUrl(ctx.businessId, `?whish=${payment.id}`),
    failureRedirectUrl: billingUrl(ctx.businessId),
  }).catch(async (error: unknown) => {
    await planPayments.markPlanFailed(prisma, payment.id);
    throw error;
  });
  await runInTransaction(async (tx) => {
    await planPayments.setPlanCheckout(tx, payment.id, url);
    await recordAction(ctx, "billing.whish_started", "business", ctx.businessId, tx);
  });
  return url;
}

/** Checks a Whish plan payment with Whish and, once paid, adds its months. Repeated calls change nothing. */
export async function settlePlanPayment(planPaymentId: string, now = new Date()) {
  const payment = await planPayments.findPlanPayment(prisma, planPaymentId);
  if (!payment || payment.method !== "WHISH") throw notFound("Payment");
  if (payment.status === "PAID") return "paid";
  if (payment.status !== "PENDING") return "failed";
  const { status } = await getWhishStatus(payment.id, payment.currency);
  if (status === "failed") {
    await planPayments.markPlanFailed(prisma, payment.id);
    return "failed";
  }
  if (status !== "success") return "pending";
  await runInTransaction(async (tx) => {
    if (!(await planPayments.markPlanPaid(tx, payment.id, now))) return;
    await addPlanMonths(tx, payment.hostId, payment.plan, payment.months, now);
  });
  return "paid";
}

/**
 * Paid months of a plan paid by Whish: they follow on from what is left of the same plan, or start now. When they
 * run out without a new payment, housekeeping puts the host back on Free.
 */
async function addPlanMonths(tx: Tx, hostId: string, plan: Plan, months: number, now: Date) {
  await billing.lockHostPlan(tx, hostId);
  const current = await billing.findHostPlan(tx, hostId);
  const from =
    current.plan === plan && current.planRenewsAt && current.planRenewsAt > now ? current.planRenewsAt : now;
  await planPayments.setPlan(tx, hostId, plan, new Date(from.getTime() + months * PLAN_MONTH_MS));
}

/**
 * A Whish callback, for a guest's booking payment or a host's plan payment. The call itself proves nothing (it is unauthenticated), so it only makes Mabeet ask Whish for
 * the payment's real status.
 */
export async function handleWhishCallback(query: { payment?: string; plan?: string }) {
  if (query.payment) return settleOnlinePayment(query.payment);
  if (query.plan) return settlePlanPayment(query.plan);
  throw invalid("Missing payment reference");
}

/** Scheduled: plan months that ran out go back to Free, and Whish plan payments whose callback was missed are checked. */
export async function runPlanHousekeeping(now = new Date()) {
  const stale = await planPayments.listStalePlanPayments(
    prisma,
    {
      from: new Date(now.getTime() - PLAN_PAYMENT_CHECK_WINDOW_MS),
      to: new Date(now.getTime() - STALE_PLAN_PAYMENT_AGE_MS),
    },
    HOUSEKEEPING_BATCH_SIZE,
  );
  for (const payment of stale) {
    await settlePlanPayment(payment.id, now).catch((error: unknown) =>
      console.error("[plans] check failed", error),
    );
  }
  return { expiredPlans: await planPayments.expireWhishPlans(prisma, now), checked: stale.length };
}

/** Stripe's billing portal: change plan, update the card, see invoices, cancel. */
export async function openBillingPortal(ctx: TenantContext) {
  const { row } = await requireHost(ctx);
  if (!row.stripeCustomerId) throw invalid("Choose a plan first");
  return (await createBillingPortalSession(row.stripeCustomerId, billingUrl(ctx.businessId))).url;
}

// ---------- Stripe webhooks ----------

/** Statuses in which the host keeps what it pays for. past_due gives the card a chance to be fixed. */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

async function applyEvent(tx: Tx, event: StripeEvent, now: Date): Promise<void> {
  const object = event.data.object;
  const metaHost = object.metadata?.hostId;

  if (event.type === "checkout.session.completed") {
    if (object.mode !== "subscription") return;
    const hostId = object.client_reference_id ?? metaHost;
    if (!hostId) return;
    await billing.setHostPlan(tx, hostId, {
      stripeCustomerId: object.customer ?? null,
      stripeSubscriptionId: object.subscription ?? null,
    });
    return;
  }

  if (event.type === "invoice.paid") {
    await recordInvoice(tx, event, now);
    return;
  }

  if (!event.type.startsWith("customer.subscription.")) return;
  const byCustomer = object.customer ? await billing.findHostByCustomer(tx, object.customer) : null;
  const hostId = metaHost ?? byCustomer?.userId;
  if (!hostId) return;

  if (event.type === "customer.subscription.deleted") {
    // Only the subscription the host is on can end it; an old one finishing later changes nothing.
    const current =
      byCustomer?.stripeSubscriptionId ?? (await billing.findHostPlan(tx, hostId)).stripeSubscriptionId;
    if (current && current !== object.id) return;
    await billing.setHostPlan(tx, hostId, {
      plan: "FREE",
      stripeSubscriptionId: null,
      planRenewsAt: null,
    });
    return;
  }

  const item = object.items?.data[0];
  const plan = planForPrice(item?.price.id);
  const paid = object.status !== undefined && PAID_STATUSES.has(object.status);
  const periodEnd = object.cancel_at ?? object.current_period_end ?? item?.current_period_end;
  await billing.setHostPlan(tx, hostId, {
    plan: paid && plan ? plan : "FREE",
    stripeCustomerId: object.customer ?? undefined,
    stripeSubscriptionId: object.id,
    planRenewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
  });
}

/** A paid Stripe invoice is a plan payment: Mabeet's revenue. */
async function recordInvoice(tx: Tx, event: StripeEvent, now: Date) {
  const invoice = event.data.object;
  if (!invoice.amount_paid || !invoice.customer) return;
  const host = await billing.findHostByCustomer(tx, invoice.customer);
  if (!host) return;
  const line = invoice.lines?.data[0];
  const plan = planForPrice(line?.pricing?.price_details?.price ?? line?.price?.id) ?? "PRO";
  await planPayments.createPlanPayment(tx, {
    hostId: host.userId,
    plan,
    amountCents: invoice.amount_paid,
    currency: (invoice.currency ?? "usd").toUpperCase(),
    method: "STRIPE",
    providerRef: invoice.id,
    status: "PAID",
    paidAt: now,
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type WebhookResult = "applied" | "duplicate" | "rejected";

/**
 * Stripe's webhook. The signature proves Stripe sent it; the event id, stored in the same transaction that
 * applies it, makes a retried or replayed event a no-op. If applying fails, nothing is stored and Stripe retries.
 */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  now = new Date(),
): Promise<WebhookResult> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !verifyWebhookSignature(rawBody, signature, secret, now.getTime())) return "rejected";
  const parsed = stripeEvent.safeParse(parseJson(rawBody));
  if (!parsed.success) return "rejected";
  const event = parsed.data;
  const result = await runInTransaction(async (tx): Promise<WebhookResult> => {
    const first = await billing.recordWebhookEvent(tx, {
      provider: "stripe",
      eventId: event.id,
      payload: { type: event.type, object: event.data.object.id },
    });
    if (!first) return "duplicate";
    await applyEvent(tx, event, now);
    return "applied";
  });
  // A guest's card payment: settled after the commit, because settling asks Stripe and may refund. If Stripe can't
  // be reached now, housekeeping checks the payment again within minutes.
  const paymentId = bookingPaymentOf(event);
  if (result === "applied" && paymentId) {
    await settleOnlinePayment(paymentId, now).catch((error: unknown) =>
      console.error("[payments] card payment not settled yet", error),
    );
  }
  return result;
}

/** The booking payment behind a finished Stripe Checkout for a booking, or null for any other event. */
function bookingPaymentOf(event: StripeEvent): string | null {
  const object = event.data.object;
  if (event.type !== "checkout.session.completed" || object.mode !== "payment") return null;
  return object.metadata?.paymentId ?? null;
}
