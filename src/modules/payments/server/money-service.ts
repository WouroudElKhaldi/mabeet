import type { Tx } from "@/server/db/client";
import { lockBusiness } from "./money-repository";

/**
 * Holds the business's money until the transaction ends, so two changes to it (two payouts, two plan months) take
 * turns and never spend or extend from the same starting point. Other modules pass their own transaction in.
 */
export function lockBusinessMoney(tx: Tx, businessId: string) {
  return lockBusiness(tx, businessId);
}
