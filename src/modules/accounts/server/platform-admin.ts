import { auth } from "@/server/auth/better-auth";
import { prisma } from "@/server/db/client";
import { findUserByEmail, makePlatformAdmin } from "./account-repository";
import { createVerifiedAccount } from "./invited-account";

/**
 * Makes this person a platform admin who signs in with this password. Nobody can become one by signing up
 * (platformRole is not an input); only this, run from `pnpm admins:create`. A new person gets a verified account;
 * an existing account keeps everything it has and gets the new password, so running it twice never makes a copy.
 */
export async function ensurePlatformAdmin(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(prisma, email);
  const user =
    existing ??
    (await createVerifiedAccount({ name: input.name, email, password: input.password, locale: "en" }));
  if (existing) {
    const context = await auth.$context;
    const hash = await context.password.hash(input.password);
    const accounts = await context.internalAdapter.findAccounts(existing.id);
    if (accounts.some((account) => account.providerId === "credential")) {
      await context.internalAdapter.updatePassword(existing.id, hash);
    } else {
      await context.internalAdapter.linkAccount({
        userId: existing.id,
        providerId: "credential",
        accountId: existing.id,
        password: hash,
      });
    }
  }
  await makePlatformAdmin(prisma, user.id);
  return { userId: user.id, created: !existing };
}
