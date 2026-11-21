import { prisma } from "@/server/db/client";
import { findPlaceHost } from "./billing-repository";
import { sumPaidPlans } from "./plan-payment-repository";

// What other modules read about the plans a place's host paid for.

/**
 * What the place's host paid Mabeet for plans, by currency, for the savings the place is shown. One plan covers all
 * of a host's places, so it is the host's whole plan spend.
 */
export async function getPlanFeesPaid(businessId: string) {
  const place = await findPlaceHost(prisma, businessId);
  return place ? sumPaidPlans(prisma, place.hostId) : [];
}
