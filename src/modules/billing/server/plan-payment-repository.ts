import type { Plan } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

// Plan payments: a host paying for a plan, by card (a Stripe invoice) or by Whish (a month at a time).

export function createPlanPayment(
  db: Db,
  input: {
    businessId: string;
    /** The owner who started it; null for Stripe renewals. */
    paidById?: string | null;
    plan: Plan;
    months?: number;
    amountCents: number;
    currency: string;
    /** Plans are only ever paid instantly; the database refuses any other method. */
    method: "STRIPE" | "WHISH";
    providerRef: string;
    status: "PENDING" | "PAID";
    paidAt?: Date;
  },
) {
  return db.planPayment.create({ data: input });
}

export function findPlanPayment(db: Db, id: string) {
  return db.planPayment.findFirst({ where: { id, isDeleted: false } });
}

export function setPlanCheckout(db: Db, id: string, checkoutUrl: string) {
  return db.planPayment.update({ where: { id }, data: { checkoutUrl }, select: { id: true } });
}

/** Marks a plan payment paid, once: when two callbacks arrive together, only one gets true. */
export async function markPlanPaid(tx: Tx, id: string, paidAt: Date): Promise<boolean> {
  const { count } = await tx.planPayment.updateMany({
    where: { id, status: { in: ["PENDING", "FAILED"] }, isDeleted: false },
    data: { status: "PAID", paidAt },
  });
  return count === 1;
}

/** Marks a pending plan payment failed, when Whish says it ran out unpaid. */
export async function markPlanFailed(db: Db, id: string): Promise<void> {
  await db.planPayment.updateMany({
    where: { id, status: "PENDING", isDeleted: false },
    data: { status: "FAILED" },
  });
}

/** Whish plan payments still pending, started within the window: callbacks that may have been missed. */
export function listStalePlanPayments(db: Db, window: { from: Date; to: Date }, take: number) {
  return db.planPayment.findMany({
    where: {
      status: "PENDING",
      method: "WHISH",
      createdAt: { gte: window.from, lt: window.to },
      isDeleted: false,
    },
    orderBy: { createdAt: "asc" },
    take,
  });
}

/** Whish plans are paid month by month; a month that ran out without a new payment goes back to Free. */
export async function expireWhishPlans(db: Db, now: Date): Promise<number> {
  const { count } = await db.business.updateMany({
    where: { plan: { not: "FREE" }, stripeSubscriptionId: null, planRenewsAt: { lt: now } },
    data: { plan: "FREE", planRenewsAt: null },
  });
  return count;
}

export function extendPlan(tx: Tx, businessId: string, plan: Plan, renewsAt: Date) {
  return tx.business.update({
    where: { id: businessId },
    data: { plan, planRenewsAt: renewsAt },
    select: { id: true },
  });
}
