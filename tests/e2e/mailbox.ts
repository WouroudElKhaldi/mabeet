import { PrismaClient } from "@prisma/client";
import { e2eDatabaseUrl } from "./e2e-database";

// What clicking cannot do: open an email. The browser tests sign up on reserved test addresses, which are never sent
// to, so opening the confirmation link is done here, on the browser tests' database only, for the one new account
// the test itself just made.

const database = new PrismaClient({ datasourceUrl: e2eDatabaseUrl() });

/** The person opened the link in their "Confirm your email" email. */
export async function confirmEmail(email: string) {
  const { count } = await database.user.updateMany({
    where: { email, emailVerified: false },
    data: { emailVerified: true },
  });
  if (count === 0) throw new Error(`No account waiting to confirm ${email}`);
}
