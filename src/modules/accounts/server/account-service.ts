import { prisma, runInTransaction } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import * as accounts from "./account-repository";

/** "Download my data": everything held about this person, as plain JSON. */
export async function exportMyData(userId: string, now = new Date()) {
  const data = await accounts.findMyData(prisma, userId);
  if (!data) throw notFound("Account");
  return { exportedAt: now.toISOString(), ...data };
}

/**
 * Deletes the signed-in person's account after they type their email: the row is marked deleted, never removed
 * (see softDeleteUser). Refused while they are the only owner of a business, so a place is never left without
 * anyone who can run it.
 */
export async function deleteMyAccount(
  user: { id: string; email: string },
  typedEmail: string,
  now = new Date(),
) {
  if (typedEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw invalid("Type your email exactly to confirm");
  }
  const soleOwned = await accounts.listSoleOwnedBusinesses(prisma, user.id);
  if (soleOwned.length > 0) {
    throw conflict(`You are the only owner of ${soleOwned.join(", ")}. Add another owner first.`);
  }
  await runInTransaction((tx) => accounts.softDeleteUser(tx, user.id, now));
}

/** The live account with this email, if any. Other modules ask through here instead of reading the user table. */
export function findAccountByEmail(email: string) {
  return accounts.findUserByEmail(prisma, email);
}

/** The email of a live account, for another module that needs to write to the person (a checkout's receipt). */
export async function findAccountEmail(userId: string): Promise<string | null> {
  return (await accounts.findUserById(prisma, userId))?.email ?? null;
}
