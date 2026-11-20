import type { OfferKind, Plan } from "@prisma/client";

// Host plans. Prices are shown on /pricing; Stripe charges whatever its price objects say (STRIPE_PRICE_STARTER,
// STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS, STRIPE_PRICE_PREMIUM), so keep the two in step. null means unlimited.
// Every plan gets unlimited direct bookings, online payment, guest emails, phone alerts, calendar sync, and our help
// setting the place up; what differs is below.

/** From the smallest plan to the largest: "higher" means later in this list. */
export const PLANS = ["FREE", "STARTER", "PRO", "BUSINESS", "PREMIUM"] as const satisfies readonly Plan[];
export type PlanName = (typeof PLANS)[number];

/** The plans a host can pay for. */
export const PAID_PLANS = ["STARTER", "PRO", "BUSINESS", "PREMIUM"] as const satisfies readonly Plan[];
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

/**
 * How long a place is featured on the home page for free with its plan, and how often. The admin features it by hand
 * (Featured places), as for a place that pays for more.
 */
type FeaturedAllowance = "weekPerSeason" | "monthPerYear" | "monthPerSeason";

interface PlanLimits {
  monthlyUsd: number;
  rooms: number | null;
  /** Experiences and services. */
  offerings: number | null;
  /** Everyone on the team, the owner included. */
  members: number | null;
  /** The Analytics page. */
  analytics: boolean;
  /** Connecting an AI app (Claude, ChatGPT…) to the place over MCP, with a key or by signing in. */
  mcp: boolean;
  /** Our answers come first. */
  prioritySupport: boolean;
  featured: FeaturedAllowance | null;
}

/** A plan feature that can be switched off, as the server checks it. */
export type PlanFeature = "analytics" | "mcp";

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  FREE: {
    monthlyUsd: 0,
    rooms: 1,
    offerings: 1,
    members: 1,
    analytics: false,
    mcp: false,
    prioritySupport: false,
    featured: null,
  },
  STARTER: {
    monthlyUsd: 30,
    rooms: 3,
    offerings: 3,
    members: 2,
    analytics: true,
    mcp: false,
    prioritySupport: false,
    featured: null,
  },
  PRO: {
    monthlyUsd: 50,
    rooms: 7,
    offerings: null,
    members: 3,
    analytics: true,
    mcp: true,
    prioritySupport: false,
    featured: "weekPerSeason",
  },
  BUSINESS: {
    monthlyUsd: 100,
    rooms: 10,
    offerings: null,
    members: 4,
    analytics: true,
    mcp: true,
    prioritySupport: true,
    featured: "monthPerYear",
  },
  PREMIUM: {
    monthlyUsd: 200,
    rooms: null,
    offerings: null,
    members: null,
    analytics: true,
    mcp: true,
    prioritySupport: true,
    featured: "monthPerSeason",
  },
};

/** A limit as the plan messages count it: a number, or "unlimited" for null. */
export const allowanceOf = (value: number | null) => ({
  count: value ?? 0,
  unlimited: value === null ? "yes" : "no",
});

/** The smallest plan that includes a feature, to name in "upgrade to …". */
export const smallestPlanWith = (feature: PlanFeature): PlanName =>
  PLANS.find((plan) => PLAN_LIMITS[plan][feature]) ?? "PREMIUM";
