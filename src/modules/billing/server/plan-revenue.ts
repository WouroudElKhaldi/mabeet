import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { sumPlanRevenue, sumPlanRevenueByMonth } from "./plan-payment-repository";

/** How many months the admin's revenue chart goes back, this month included. */
const MONTHS_SHOWN = 12;

/** The first moment of the month `monthsBack` months before `now`'s, in UTC. */
function monthStart(now: Date, monthsBack: number) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
}

/**
 * What Mabeet earned from plans, Mabeet's own revenue: all time, this month, by card (Stripe) or Whish over the last
 * 12 months, and month by month. Hosts' booking money is not revenue and is never in here.
 */
export async function getPlanRevenue(actor: PlatformActor, now = new Date()) {
  requirePlatformAdmin(actor);
  const [allTime, months] = await Promise.all([
    sumPlanRevenue(prisma),
    sumPlanRevenueByMonth(prisma, monthStart(now, MONTHS_SHOWN - 1)),
  ]);
  const thisMonth = monthStart(now, 0).toISOString().slice(0, 7);
  const total = (rows: typeof months) => {
    const byCurrency = new Map<string, { currency: string; cents: number; payments: number }>();
    for (const row of rows) {
      const found = byCurrency.get(row.currency) ?? { currency: row.currency, cents: 0, payments: 0 };
      found.cents += row.cents;
      found.payments += row.payments;
      byCurrency.set(row.currency, found);
    }
    return [...byCurrency.values()];
  };
  return {
    allTime,
    thisMonth: total(months.filter((row) => row.month === thisMonth)),
    byCard: total(months.filter((row) => row.method === "STRIPE")),
    byWhish: total(months.filter((row) => row.method === "WHISH")),
    byMonth: months,
  };
}
