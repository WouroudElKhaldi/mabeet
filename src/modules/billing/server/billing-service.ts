import type { Plan } from "@prisma/client";
import { type PaidPlan, PLAN_LIMITS } from "@/config/plans";
import { findAccountEmail } from "@/modules/accounts/server";
import { recordAction } from "@/modules/audit/server";
import {
  createBillingPortalSession,
  createSubscriptionCheckout,
  createWhishPayment,
  getWhishStatus,
  lockBusinessMoney,
  type StripeEvent,
  stripeEnabled,
  stripeEvent,
  verifyWebhookSignature,
  whishEnabled,
} from "@/modules/payments/server";
import { requireOwner, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction, type Tx } from "@/server/db/client";
import { env } from "@/server/env";
import { conflict, invalid, notFound, unavailable } from "@/server/errors";
import { secureToken } from "@/utils/tokens";
import * as billing from "./billing-repository";
import * as planPayments from "./plan-payment-repository";

// Host plans: what each allows, paying by card through Stripe (a subscription) or by Whish (a month at a time),
// and Stripe's webhooks keeping the plan true. Plans are always paid instantly: nothing is paid by hand and
// nothing waits for an admin. Plan payments are Mabeet's revenue.

const PLAN_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
/** A Whish plan payment still pending this long has probably lost its callback, so housekeeping asks Whish. */
const STALE_PLAN_PAYMENT_AGE_MS = 2 * 60_000;
/** Past a day, a Whish link has long run out: housekeeping stops asking about it. */
const PLAN_PAYMENT_CHECK_WINDOW_MS = 24 * 60 * 60_000;
const HOUSEKEEPING_BATCH_SIZE = 25;

type Counted = "rooms" | "offerings" | "members";

const LIMIT_MESSAGES: Record<Counted, (max: number) => string> = {
  rooms: (max) => `Your plan allows up to ${max} rooms. Upgrade to add more.`,
  offerings: (max) => `Your plan allows up to ${max} experiences or services. Upgrade to add more.`,
  members: (max) => `Your plan allows up to ${max} team members, you included. Upgrade to add more.`,
};

async function loadBilling(businessId: string) {
  const row = await billing.findBilling(prisma, businessId);
  if (!row) throw notFound("Business");
  return row;
}

/** Refuses adding one more room, experience or team member past the plan's limit. */
export async function assertPlanAllowsAnother(businessId: string, what: Counted): Promise<void> {
  const row = await loadBilling(businessId);
  const max = PLAN_LIMITS[row.plan][what];
  const used = what === "members" ? row._count.memberships : row._count[what];
  if (max !== null && used >= max) throw conflict(LIMIT_MESSAGES[what](max));
}

/** For the billing page: the plan, what is used against it, and which ways to pay are on. */
export async function getBilling(ctx: TenantContext) {
  requirePermission(ctx, "settings.manage");
  const row = await loadBilling(ctx.businessId);
  return {
    plan: row.plan,
    limits: PLAN_LIMITS[row.plan],
    usage: { rooms: row._count.rooms, offerings: row._count.offerings, members: row._count.memberships },
    renewsAt: row.planRenewsAt,
    paysByCard: Boolean(row.stripeSubscriptionId),
    cardEnabled: stripeEnabled() && Boolean(env.STRIPE_PRICE_PRO && env.STRIPE_PRICE_BUSINESS),
    whishEnabled: whishEnabled(),
    canManage: ctx.isOwner,
  };
}

const priceFor = (plan: PaidPlan) => (plan === "PRO" ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_BUSINESS);

const OWNER_ONLY = "Only an owner can change the plan";

function planForPrice(priceId: string | null | undefined): Plan | null {
  if (priceId && priceId === env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId && priceId === env.STRIPE_PRICE_BUSINESS) return "BUSINESS";
  return null;
}

const billingUrl = (businessId: string, query = "") =>
  new URL(`/dashboard/${businessId}/billing${query}`, env.BETTER_AUTH_URL).toString();

/** Returns the Stripe Checkout page to send the owner to. The plan starts when Stripe's webhook confirms it. */
export async function startCheckout(ctx: TenantContext, plan: PaidPlan) {
  requireOwner(ctx, OWNER_ONLY);
  const priceId = priceFor(plan);
  if (!stripeEnabled() || !priceId) throw unavailable("Card payments are not set up yet.");
  const row = await loadBilling(ctx.businessId);
  // A paying business changes plan in the billing portal, so it never ends up with two subscriptions.
  if (row.stripeSubscriptionId)
    throw conflict("You already pay by card. Change your plan from Manage billing.");
  const session = await createSubscriptionCheckout({
    priceId,
    businessId: ctx.businessId,
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
 * runs out without a new payment, the business goes back to Free. Our row is written first and Whish is called
 * after: if Whish refuses, the row is marked failed, so no payment is left waiting for a link that never existed.
 */
export async function startWhishPlanCheckout(ctx: TenantContext, plan: PaidPlan) {
  requireOwner(ctx, OWNER_ONLY);
  if (!whishEnabled()) throw unavailable("Whish payments are not set up yet.");
  const row = await loadBilling(ctx.businessId);
  if (row.stripeSubscriptionId) throw conflict("You pay by card. Change your plan from Manage billing.");
  const payment = await planPayments.createPlanPayment(prisma, {
    businessId: ctx.businessId,
    paidById: ctx.userId,
    plan,
    months: 1,
    amountCents: PLAN_LIMITS[plan].monthlyUsd * 100,
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
    await addPlanMonths(tx, payment.businessId, payment.plan, payment.months, now);
  });
  return "paid";
}

/**
 * Paid months of a plan paid by Whish: they follow on from what is left of the same plan, or start now. When they
 * run out without a new payment, housekeeping puts the business back on Free.
 */
async function addPlanMonths(tx: Tx, businessId: string, plan: Plan, months: number, now: Date) {
  await lockBusinessMoney(tx, businessId);
  const current = await billing.findBilling(tx, businessId);
  const from =
    current?.plan === plan && current.planRenewsAt && current.planRenewsAt > now ? current.planRenewsAt : now;
  await planPayments.extendPlan(tx, businessId, plan, new Date(from.getTime() + months * PLAN_MONTH_MS));
}

/**
 * A Whish callback. The call itself proves nothing (it is unauthenticated), so it only makes Mabeet ask Whish for
 * the payment's real status.
 */
export async function handleWhishCallback(query: { plan?: string }) {
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
  requireOwner(ctx, OWNER_ONLY);
  const row = await loadBilling(ctx.businessId);
  if (!row.stripeCustomerId) throw invalid("Choose a plan first");
  return (await createBillingPortalSession(row.stripeCustomerId, billingUrl(ctx.businessId))).url;
}

// ---------- Stripe webhooks ----------

/** Statuses in which the business keeps what it pays for. past_due gives the card a chance to be fixed. */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

async function applyEvent(tx: Tx, event: StripeEvent, now: Date): Promise<void> {
  const object = event.data.object;
  const metaBusiness = object.metadata?.businessId;

  if (event.type === "checkout.session.completed") {
    if (object.mode !== "subscription") return;
    const businessId = object.client_reference_id ?? metaBusiness;
    if (!businessId) return;
    await billing.setBilling(tx, businessId, {
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
  const byCustomer = object.customer ? await billing.findBusinessIdByCustomer(tx, object.customer) : null;
  const businessId = metaBusiness ?? byCustomer?.id;
  if (!businessId) return;

  if (event.type === "customer.subscription.deleted") {
    // Only the subscription the business is on can end it; an old one finishing later changes nothing.
    const current =
      byCustomer?.stripeSubscriptionId ?? (await billing.findBilling(tx, businessId))?.stripeSubscriptionId;
    if (current && current !== object.id) return;
    await billing.setBilling(tx, businessId, {
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
  await billing.setBilling(tx, businessId, {
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
  const business = await billing.findBusinessIdByCustomer(tx, invoice.customer);
  if (!business) return;
  const line = invoice.lines?.data[0];
  const plan = planForPrice(line?.pricing?.price_details?.price ?? line?.price?.id) ?? "PRO";
  await planPayments.createPlanPayment(tx, {
    businessId: business.id,
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
  return runInTransaction(async (tx) => {
    const first = await billing.recordWebhookEvent(tx, {
      provider: "stripe",
      eventId: event.id,
      payload: { type: event.type, object: event.data.object.id },
    });
    if (!first) return "duplicate";
    await applyEvent(tx, event, now);
    return "applied";
  });
}
