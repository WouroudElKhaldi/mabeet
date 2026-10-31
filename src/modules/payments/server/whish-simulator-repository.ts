import type { Db } from "@/server/db/client";

// The simulated Whish Pay server's own state. Only used when WHISH_MODE=simulator.

/**
 * Saves a new simulated payment, or returns the one already saved under this externalId: Whish answers a repeated
 * create with the first payment, so two calls at once still end with one row.
 */
export function upsertSimulatedPayment(
  db: Db,
  payment: {
    externalId: string;
    code: string;
    amount: string;
    currency: string;
    invoice: string | null;
    successCallbackUrl: string;
    failureCallbackUrl: string;
    successRedirectUrl: string;
    failureRedirectUrl: string;
  },
) {
  return db.whishSandboxPayment.upsert({
    where: { externalId: payment.externalId },
    create: payment,
    update: {},
  });
}

export function findSimulatedPayment(db: Db, externalId: string) {
  return db.whishSandboxPayment.findUnique({ where: { externalId } });
}

export function findSimulatedPaymentByCode(db: Db, code: string) {
  return db.whishSandboxPayment.findUnique({ where: { code } });
}

/** Moves a payment between Whish's states, only from the state given. Returns false if it was elsewhere. */
export async function moveSimulatedPayment(
  db: Db,
  externalId: string,
  from: string,
  to: { status: string; payerPhone?: string },
): Promise<boolean> {
  const { count } = await db.whishSandboxPayment.updateMany({
    where: { externalId, status: from },
    data: to,
  });
  return count === 1;
}
