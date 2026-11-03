import { prisma } from "@/server/db/client";
import { sumPaidPlans } from "./plan-payment-repository";

// What other modules read about the plans a place paid for.

/** What a place paid Mabeet for plans since it joined, by currency, for the savings it is shown. */
export function getPlanFeesPaid(businessId: string) {
  return sumPaidPlans(prisma, businessId);
}
