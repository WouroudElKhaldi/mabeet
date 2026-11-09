import type { PayoutMethod } from "@prisma/client";
import { recordAction, recordPlatformAction } from "@/modules/audit/server";
import {
  createPayoutRequest,
  listBusinessPayouts,
  lockBusinessMoney,
  sumPayouts,
} from "@/modules/payments/server";
import {
  type PlatformActor,
  requireOwner,
  requirePlatformAdmin,
  type TenantContext,
} from "@/server/auth/tenant-context";
import { type Db, prisma, runInTransaction } from "@/server/db/client";
import { conflict } from "@/server/errors";
import { todayUtc } from "@/utils/dates";
import * as payments from "./payment-repository";

// What Mabeet holds for each host, worked out every time and never stored: what guests paid online, minus refunds,
// minus payouts sent or asked for. Only money for confirmed stays that have started can be paid out: a stay that has
// started can no longer be cancelled, so a refund never has to give back money already sent to the owner. The
// booking engine owns the payments, so this side lives here and calls `payments` for the payout rows.

const OWNER_ONLY = "Only an owner can see and ask for payouts";
/** How many online payments the payouts page lists. */
const PAYMENTS_SHOWN = 50;

interface Balance {
  currency: string;
  /** Confirmed stays that have started, net of refunds. */
  earnedCents: number;
  /** Stays still ahead (or waiting for an answer), net of refunds: available once they start. */
  upcomingCents: number;
  paidOutCents: number;
  requestedCents: number;
  /** What can be asked for now: earned, minus payouts sent or already asked for. */
  availableCents: number;
}

/** Joins what was collected with what was paid out, per business and currency. */
async function balances(businessId: string | null, now: Date, db: Db = prisma) {
  const [held, paidOut] = await Promise.all([
    payments.sumHeldMoney(db, businessId, todayUtc(now)),
    sumPayouts(businessId, db),
  ]);
  const rows = new Map<string, Balance & { businessId: string }>();
  const row = (forBusiness: string, currency: string) => {
    const key = `${forBusiness}:${currency}`;
    const found = rows.get(key);
    if (found) return found;
    const created = {
      businessId: forBusiness,
      currency,
      earnedCents: 0,
      upcomingCents: 0,
      paidOutCents: 0,
      requestedCents: 0,
      availableCents: 0,
    };
    rows.set(key, created);
    return created;
  };
  for (const money of held) Object.assign(row(money.businessId, money.currency), money);
  for (const money of paidOut) Object.assign(row(money.businessId, money.currency), money);
  return [...rows.values()]
    .map((balance) => ({
      ...balance,
      availableCents: balance.earnedCents - balance.paidOutCents - balance.requestedCents,
    }))
    .sort((a, b) => a.businessId.localeCompare(b.businessId) || a.currency.localeCompare(b.currency));
}

/** The payouts page: what is available, coming and paid out, the payouts, the online payments. Owners only. */
export async function getPayouts(ctx: TenantContext, now = new Date()) {
  requireOwner(ctx, OWNER_ONLY);
  const [money, { history, last }, paymentsList] = await Promise.all([
    balances(ctx.businessId, now),
    listBusinessPayouts(ctx.businessId),
    payments.listBusinessPayments(prisma, ctx.businessId, PAYMENTS_SHOWN),
  ]);
  return {
    balances: money.map(({ businessId: _, ...balance }) => balance),
    payouts: history,
    payments: paymentsList,
    lastDetails: last,
  };
}

interface PayoutRequest {
  amountCents: number;
  currency: string;
  method: PayoutMethod;
  accountName: string;
  bankName?: string | null;
  iban?: string | null;
  whishPhone?: string | null;
}

/**
 * The owner asks Mabeet to send money. The business's money is locked while the balance is checked and the request
 * saved, so two requests sent at once can never add up to more than what is available.
 */
export async function requestPayout(ctx: TenantContext, input: PayoutRequest, now = new Date()) {
  requireOwner(ctx, OWNER_ONLY);
  const bank = input.method === "BANK_TRANSFER";
  return runInTransaction(async (tx) => {
    await lockBusinessMoney(tx, ctx.businessId);
    const balance = (await balances(ctx.businessId, now, tx)).find((row) => row.currency === input.currency);
    if (input.amountCents > (balance?.availableCents ?? 0)) {
      throw conflict("That is more than is available to pay out.");
    }
    const payout = await createPayoutRequest(tx, {
      businessId: ctx.businessId,
      amountCents: input.amountCents,
      currency: input.currency,
      method: input.method,
      accountName: input.accountName,
      bankName: bank ? (input.bankName ?? null) : null,
      iban: bank ? (input.iban ?? null) : null,
      whishPhone: bank ? null : (input.whishPhone ?? null),
      requestedById: ctx.userId,
    });
    await recordAction(ctx, "payout.requested", "payout", payout.id, tx);
    return payout;
  });
}

// ---------- Platform admin ----------

/** The admin sent a refund by hand, with the transfer's reference. Each one is marked once. */
export async function markRefundSent(
  actor: PlatformActor,
  refundId: string,
  reference: string | null,
  now = new Date(),
) {
  requirePlatformAdmin(actor);
  await runInTransaction(async (tx) => {
    const refund = await payments.markRefundSentByHand(tx, refundId, {
      doneById: actor.userId,
      providerRef: reference,
      doneAt: now,
    });
    if (!refund) throw conflict("This refund is not waiting to be sent.");
    await recordPlatformAction(
      actor,
      { businessId: refund.businessId, action: "refund.sent_by_hand", entity: "refund", entityId: refund.id },
      tx,
    );
  });
}
