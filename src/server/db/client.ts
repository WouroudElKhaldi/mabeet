import { Prisma, PrismaClient } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";

// Services pick the client or a transaction and hand it to repositories, which are the only code that queries it.
// Routes and pages never import this module (enforced by ESLint).

const SAFE_MONEY = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Money is stored as BIGINT minor units, because LBP totals outgrow a 32-bit int, and handled as a plain number.
 * A number is exact up to 2^53 minor units (about 90 trillion LBP); anything bigger is refused, never rounded.
 */
export function moneyNumber(value: bigint | number): number {
  if (value > SAFE_MONEY || value < -SAFE_MONEY)
    throw new Error("A money amount is too large to handle exactly");
  return Number(value);
}

/** Every BIGINT money column, read back as a number. Writes accept numbers as they are. */
const moneyAsNumbers = Prisma.defineExtension({
  name: "money-as-numbers",
  result: {
    room: {
      baseRateCents: { needs: { baseRateCents: true }, compute: (row) => moneyNumber(row.baseRateCents) },
    },
    rateOverride: { rateCents: { needs: { rateCents: true }, compute: (row) => moneyNumber(row.rateCents) } },
    booking: { totalCents: { needs: { totalCents: true }, compute: (row) => moneyNumber(row.totalCents) } },
    sessionBooking: {
      totalCents: { needs: { totalCents: true }, compute: (row) => moneyNumber(row.totalCents) },
    },
    offering: { priceCents: { needs: { priceCents: true }, compute: (row) => moneyNumber(row.priceCents) } },
    payment: {
      amountCents: { needs: { amountCents: true }, compute: (row) => moneyNumber(row.amountCents) },
      refundedCents: { needs: { refundedCents: true }, compute: (row) => moneyNumber(row.refundedCents) },
    },
    refund: { amountCents: { needs: { amountCents: true }, compute: (row) => moneyNumber(row.amountCents) } },
    payout: { amountCents: { needs: { amountCents: true }, compute: (row) => moneyNumber(row.amountCents) } },
    planPayment: {
      amountCents: { needs: { amountCents: true }, compute: (row) => moneyNumber(row.amountCents) },
    },
    aiUsage: {
      costMicroUsd: { needs: { costMicroUsd: true }, compute: (row) => moneyNumber(row.costMicroUsd) },
    },
  },
});

const createClient = () => new PrismaClient().$extends(moneyAsNumbers);

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Omit<typeof prisma, ITXClientDenyList>;

/** Either the root client or an interactive transaction; every repository function accepts one. */
export type Db = typeof prisma | Tx;

/**
 * Runs every step of one change in a single transaction: if any step throws, Postgres undoes the steps before it,
 * so nothing is ever half saved. Never call an outside service (Stripe, Whish, R2, email) inside `work`.
 */
export function runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  // Requests for the same room queue on its row lock, so allow time to get a connection and the lock.
  return prisma.$transaction(work, { maxWait: 10_000, timeout: 15_000 });
}

const EXCLUSION_VIOLATION = "23P01";

/** True when Postgres rejected a write because of an EXCLUDE constraint (overlapping stays). */
export function isOverlapError(error: unknown): boolean {
  return JSON.stringify(error, Object.getOwnPropertyNames(error ?? {})).includes(EXCLUSION_VIOLATION);
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
