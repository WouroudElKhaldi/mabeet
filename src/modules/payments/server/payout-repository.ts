import type { PayoutMethod, Prisma } from "@prisma/client";
import type { DecidedPayoutStatus } from "@/config/enums";
import { type Db, moneyNumber, type Tx } from "@/server/db/client";

// Payouts: a host asking Mabeet to send what guests paid online for them, and the admin sending it by hand. What is
// available to ask for is worked out from the payments (the booking engine's) and these rows; nothing stores it.

export interface NewPayout {
  businessId: string;
  amountCents: number;
  currency: string;
  method: PayoutMethod;
  accountName: string;
  bankName: string | null;
  iban: string | null;
  whishPhone: string | null;
  requestedById: string;
}

export function createPayout(tx: Tx, payout: NewPayout) {
  return tx.payout.create({ data: payout });
}

export function listBusinessPayouts(db: Db, businessId: string, take: number) {
  return db.payout.findMany({
    where: { businessId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** The details the business used last, to fill in its next request. */
export function findLastPayout(db: Db, businessId: string) {
  return db.payout.findFirst({
    where: { businessId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: { method: true, accountName: true, bankName: true, iban: true, whishPhone: true },
  });
}

/** Payouts sent and payouts still asked for, per business and currency. `businessId` null reads every business. */
export async function sumPayouts(db: Db, businessId: string | null) {
  const rows = await db.$queryRaw<
    Array<{ businessId: string; currency: string; paid: bigint; requested: bigint }>
  >`
    SELECT "businessId", currency,
           COALESCE(SUM("amountCents") FILTER (WHERE status = 'PAID'), 0)::bigint AS paid,
           COALESCE(SUM("amountCents") FILTER (WHERE status = 'REQUESTED'), 0)::bigint AS requested
    FROM "Payout"
    WHERE NOT "isDeleted" AND status IN ('PAID', 'REQUESTED')
      AND (${businessId}::text IS NULL OR "businessId" = ${businessId})
    GROUP BY 1, 2`;
  return rows.map((row) => ({
    businessId: row.businessId,
    currency: row.currency,
    paidOutCents: moneyNumber(row.paid),
    requestedCents: moneyNumber(row.requested),
  }));
}

/**
 * What the admin's payout tables filter by: words in the place's name or the account's name, how it is sent, and,
 * for payouts already decided, whether it was sent or refused.
 */
export interface PayoutFilters {
  q: string;
  method?: PayoutMethod;
  status?: DecidedPayoutStatus;
}

/** Requests still waiting (`waiting`), or payouts already decided, that match the filters. */
function payoutWhere(waiting: boolean, filters: PayoutFilters): Prisma.PayoutWhereInput {
  const words = { contains: filters.q, mode: "insensitive" } as const;
  return {
    isDeleted: false,
    status: waiting ? "REQUESTED" : (filters.status ?? { not: "REQUESTED" }),
    method: filters.method,
    ...(filters.q ? { OR: [{ business: { name: words } }, { accountName: words }] } : {}),
  };
}

/**
 * One page of payouts, with the business each is for: requests waiting for an admin the oldest first (the next to
 * send on top), or payouts already decided the latest first.
 */
export function listPayoutPage(
  db: Db,
  waiting: boolean,
  filters: PayoutFilters,
  page: { skip: number; take: number },
) {
  return db.payout.findMany({
    where: payoutWhere(waiting, filters),
    orderBy: waiting ? { createdAt: "asc" } : { decidedAt: "desc" },
    skip: page.skip,
    take: page.take,
    include: { business: { select: { id: true, name: true } } },
  });
}

export function countPayouts(db: Db, waiting: boolean, filters: PayoutFilters) {
  return db.payout.count({ where: payoutWhere(waiting, filters) });
}

export function findPayout(db: Db, payoutId: string) {
  return db.payout.findFirst({ where: { id: payoutId, isDeleted: false } });
}

/** Settles a request once. Returns false when someone already decided it. */
export async function decidePayout(
  db: Db,
  payoutId: string,
  decision: {
    status: "PAID" | "REJECTED";
    reference: string | null;
    adminNote: string | null;
    decidedById: string;
    decidedAt: Date;
  },
): Promise<boolean> {
  const { count } = await db.payout.updateMany({
    where: { id: payoutId, status: "REQUESTED", isDeleted: false },
    data: decision,
  });
  return count === 1;
}
