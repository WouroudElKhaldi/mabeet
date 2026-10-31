import { runPlanHousekeeping } from "@/modules/billing/server";

/**
 * Housekeeping: ends Whish plan months that ran out and re-checks Whish plan payments whose callback never came.
 * Rate-limit windows need no tidying: they expire in Redis by themselves. The worker runs it every five minutes;
 * POST /api/cron/expire-holds runs it on demand.
 */
export async function runHousekeeping(now = new Date()) {
  return { plans: await runPlanHousekeeping(now) };
}
