import type { OfferKind, Plan } from "@prisma/client";

// Host plans. Prices are shown on /pricing; Stripe charges whatever its price objects say
// (STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS), so keep the two in step. null means unlimited.

export const PLANS = ["FREE", "PRO", "BUSINESS"] as const satisfies readonly Plan[];
export type PlanName = (typeof PLANS)[number];

/** The plans a host can pay for. */
export const PAID_PLANS = ["PRO", "BUSINESS"] as const satisfies readonly Plan[];
export type PaidPlan = (typeof PAID_PLANS)[number];

/** A plan month, as Whish payments and offers count it. */
export const PLAN_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** What a plan offer gives: the plan with nothing to pay, or a share off its price. */
export const OFFER_KINDS = ["FREE", "PERCENT_OFF"] as const satisfies readonly OfferKind[];

/** The longest "first months" offer, in months (the database refuses more). */
export const MAX_OFFER_FIRST_MONTHS = 24;

/** How a plan is paid: by card (a Stripe subscription) or by Whish (a month at a time). */
export const PLAN_PAYMENT_METHODS = ["card", "whish"] as const;
export type PlanPaymentMethod = (typeof PLAN_PAYMENT_METHODS)[number];

interface PlanLimits {
  monthlyUsd: number;
  rooms: number | null;
  /** Experiences and services. */
  offerings: number | null;
  /** Everyone on the team, the owner included. */
  members: number | null;
  /** The paid AI features (F15): the team assistant and AI reports, when they are built. */
  ai: boolean;
}

export const PLAN_LIMITS: Record<(typeof PLANS)[number], PlanLimits> = {
  FREE: { monthlyUsd: 0, rooms: 3, offerings: 1, members: 2, ai: false },
  PRO: { monthlyUsd: 50, rooms: 15, offerings: null, members: 10, ai: true },
  BUSINESS: { monthlyUsd: 100, rooms: null, offerings: null, members: null, ai: true },
};
