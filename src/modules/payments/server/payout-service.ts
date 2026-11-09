import { recordPlatformAction } from "@/modules/audit/server";
import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { type Db, prisma, runInTransaction, type Tx } from "@/server/db/client";
import { conflict, notFound } from "@/server/errors";
import * as payouts from "./payout-repository";

// Payouts to hosts. Mabeet takes no commission: every cent a guest pays online is the host's, held until the stay
// starts (so a cancellation before then is refunded from it). The host asks for it; a platform admin sends it by hand
// from Mabeet's Whish or Stripe account, to the host's Whish number or bank account, and marks it sent with the
// transfer's reference. Sending is never automatic. What is available needs the booking engine's payments, so the
// booking engine works it out and calls these, under `lockBusinessMoney`.

/** How many past payouts a host's page lists. */
const HISTORY_SHOWN = 50;

/** Saves a host's request. The caller holds `lockBusinessMoney` and has checked the amount is available. */
export function createPayoutRequest(tx: Tx, payout: payouts.NewPayout) {
  return payouts.createPayout(tx, payout);
}

/** Payouts sent and still asked for, per business and currency (every business when `businessId` is null). */
export function sumPayouts(businessId: string | null, db: Db = prisma) {
  return payouts.sumPayouts(db, businessId);
}

/** A business's payouts, the latest first, and the details it used last. */
export async function listBusinessPayouts(businessId: string) {
  const [history, last] = await Promise.all([
    payouts.listBusinessPayouts(prisma, businessId, HISTORY_SHOWN),
    payouts.findLastPayout(prisma, businessId),
  ]);
  return { history, last };
}

// ---------- Platform admin ----------

/** Requests to send, the oldest first, and the latest payouts already decided. */
export async function getPayoutQueue(actor: PlatformActor, recentShown = 20) {
  requirePlatformAdmin(actor);
  const [requests, recent] = await Promise.all([
    payouts.listPayoutRequests(prisma),
    payouts.listDecidedPayouts(prisma, recentShown),
  ]);
  return { requests, recent };
}

/**
 * The admin sent the money (with the transfer's reference) or refuses the request (with a note the host sees).
 * Each request is decided once; a refused one is available to ask for again.
 */
export async function decidePayout(
  actor: PlatformActor,
  payoutId: string,
  input: { action: "paid" | "rejected"; reference?: string | null; note?: string | null },
  now = new Date(),
) {
  requirePlatformAdmin(actor);
  const payout = await payouts.findPayout(prisma, payoutId);
  if (!payout) throw notFound("Payout");
  const status = input.action === "paid" ? "PAID" : "REJECTED";
  await runInTransaction(async (tx) => {
    const changed = await payouts.decidePayout(tx, payoutId, {
      status,
      reference: input.reference ?? null,
      adminNote: input.note ?? null,
      decidedById: actor.userId,
      decidedAt: now,
    });
    if (!changed) throw conflict("This payout was already decided.");
    await recordPlatformAction(
      actor,
      {
        businessId: payout.businessId,
        action: status === "PAID" ? "payout.sent" : "payout.refused",
        entity: "payout",
        entityId: payoutId,
      },
      tx,
    );
  });
}
