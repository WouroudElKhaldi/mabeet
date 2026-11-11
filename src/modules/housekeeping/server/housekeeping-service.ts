import { runPlanHousekeeping } from "@/modules/billing/server";
import {
  expireAllStaleHolds,
  expireAllStaleSessionHolds,
  reconcilePendingPayments,
  retryPendingRefunds,
} from "@/modules/bookings/server";

/**
 * Housekeeping: checks guest payments whose callback never came, expires bookings nobody paid in time or the owner
 * never answered (freeing their nights or seats and refunding them in full), sends again refunds a provider refused, ends
 * Whish plan months that ran out and re-checks Whish plan payments. Rate-limit windows need no tidying: they expire
 * in Redis by themselves. The worker runs it every five minutes; POST /api/cron/expire-holds runs it on demand.
 */
export async function runHousekeeping(now = new Date()) {
  // Payments first: a guest who paid just before the deadline is confirmed rather than expired.
  const payments = await reconcilePendingPayments(now);
  const expired = await expireAllStaleHolds(now);
  const expiredSeats = await expireAllStaleSessionHolds(now);
  const refunds = await retryPendingRefunds(now);
  return { payments, expired, expiredSeats, refunds, plans: await runPlanHousekeeping(now) };
}
