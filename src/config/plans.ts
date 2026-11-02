import type { Plan } from "@prisma/client";

// Host plans. Prices are shown on /pricing; Stripe charges whatever its price objects say
// (STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS), so keep the two in step. null means unlimited.

export const PLANS = ["FREE", "PRO", "BUSINESS"] as const satisfies readonly Plan[];
export type PlanName = (typeof PLANS)[number];

/** The plans a host can pay for. */
export const PAID_PLANS = ["PRO", "BUSINESS"] as const satisfies readonly Plan[];
export type PaidPlan = (typeof PAID_PLANS)[number];

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
  PRO: { monthlyUsd: 10, rooms: 15, offerings: null, members: 10, ai: true },
  BUSINESS: { monthlyUsd: 20, rooms: null, offerings: null, members: null, ai: true },
};
