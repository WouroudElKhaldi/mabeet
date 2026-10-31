import type { Tx } from "@/server/db/client";

// The lock that keeps two changes to one business's money apart.

/** Locks the business row until the transaction ends. */
export async function lockBusiness(tx: Tx, businessId: string) {
  await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
}
