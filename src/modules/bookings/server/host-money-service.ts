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
  requireBusinessOwner,
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
/** Housekeeping stops retrying a refund after a day; from then on it waits for the admin to send it by hand. */
const AUTOMATIC_REFUND_WINDOW_MS = 24 * 60 * 60_000;

interface Balance {
  currency: string;
  /** Confirmed stays and sessions that have started, net of refunds. */
  earnedCents: number;
  /** Stays and sessions still ahead (or waiting for an answer), net of refunds: available once they start. */
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

/**
 * The money still with Mabeet in one currency that a refund could come from: guests' payments net of refunds, minus
 * payouts sent or asked for. `hostCents` is this business's share; `platformCents` is every business's together,
 * which is the company's money and is never shown to a host. Only the AI app's cancellation checks read it.
 */
export async function moneyFreeForRefunds(businessId: string, currency: string, now = new Date()) {
  const free = (balance: Balance) =>
    balance.earnedCents + balance.upcomingCents - balance.paidOutCents - balance.requestedCents;
  const everyBusiness = (await balances(null, now)).filter((balance) => balance.currency === currency);
  return {
    hostCents: everyBusiness
      .filter((balance) => balance.businessId === businessId)
      .reduce((total, balance) => total + free(balance), 0),
    platformCents: everyBusiness.reduce((total, balance) => total + free(balance), 0),
  };
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
    // One line per payment, the same for a stay and for seats in a session.
    payments: paymentsList.map(({ sessionBooking, ...payment }) => ({
      ...payment,
      booking: payment.booking ?? sessionBooking,
    })),
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
  requireBusinessOwner(ctx, OWNER_ONLY);
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

/** What Mabeet holds for each host that still has money with it or coming. */
export async function getHostBalances(actor: PlatformActor, now = new Date()) {
  requirePlatformAdmin(actor);
  const money = await balances(null, now);
  return money.filter((row) => row.earnedCents + row.upcomingCents - row.paidOutCents !== 0);
}

/** Refunds the providers kept refusing, to send by hand: the oldest first, with who to send each one to. */
export async function listRefundsToSend(actor: PlatformActor, now = new Date()) {
  requirePlatformAdmin(actor);
  const owed = await payments.listRefundsToSendByHand(
    prisma,
    new Date(now.getTime() - AUTOMATIC_REFUND_WINDOW_MS),
  );
  return owed.map(({ payment: { sessionBooking, ...payment }, ...refund }) => ({
    ...refund,
    payment: { ...payment, booking: payment.booking ?? sessionBooking },
  }));
}

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
