import type { OfferKind } from "@prisma/client";
import { type PaidPlan, PLAN_LIMITS, PLAN_MONTH_MS } from "@/config/plans";

// Plan offers as both sides read them: when one is open for a place, and what the plan costs under it. Pure, so the
// billing page shows the same price the checkout charges.

export interface OfferTiming {
  firstMonths: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

/** When an offer is open for a place: its first months from the day it joined, or between the offer's two dates. */
export function offerWindow(offer: OfferTiming, joinedAt: Date): { from: Date; until: Date } | null {
  if (offer.firstMonths !== null) {
    return { from: joinedAt, until: new Date(joinedAt.getTime() + offer.firstMonths * PLAN_MONTH_MS) };
  }
  if (offer.startsAt && offer.endsAt) return { from: offer.startsAt, until: offer.endsAt };
  return null;
}

/** A plan's monthly price under an offer, in cents: nothing when it is free, the share taken off otherwise. */
export function offerMonthlyCents(plan: PaidPlan, kind: OfferKind, percentOff: number | null): number {
  if (kind === "FREE") return 0;
  return Math.round((PLAN_LIMITS[plan].monthlyUsd * 100 * (100 - (percentOff ?? 0))) / 100);
}
