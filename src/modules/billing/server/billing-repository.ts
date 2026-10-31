import type { Plan, Prisma } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

// A business's plan, its Stripe ids, what it uses against the plan's limits, and processed webhooks.

export function findBilling(db: Db, businessId: string) {
  return db.business.findFirst({
    where: { id: businessId, isDeleted: false },
    select: {
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      planRenewsAt: true,
      _count: {
        select: {
          rooms: { where: { isDeleted: false } },
          offerings: { where: { isDeleted: false } },
          memberships: { where: { status: "ACTIVE", isDeleted: false } },
        },
      },
    },
  });
}

export function findBusinessIdByCustomer(db: Db, stripeCustomerId: string) {
  return db.business.findFirst({
    where: { stripeCustomerId, isDeleted: false },
    select: { id: true, stripeSubscriptionId: true },
  });
}

/** Updates a business's plan fields. An id that matches no business changes nothing, rather than failing. */
export async function setBilling(
  db: Db,
  businessId: string,
  data: {
    plan?: Plan;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    planRenewsAt?: Date | null;
  },
) {
  await db.business.updateMany({ where: { id: businessId }, data });
}

/**
 * Records a webhook event once. Run inside the transaction that applies it, so a failure rolls both back. False
 * when the event was already recorded: a retried or replayed event, even one arriving at the same moment.
 */
export async function recordWebhookEvent(
  tx: Tx,
  event: { provider: string; eventId: string; payload: Prisma.InputJsonValue },
): Promise<boolean> {
  const { count } = await tx.webhookEvent.createMany({ data: [event], skipDuplicates: true });
  return count === 1;
}
