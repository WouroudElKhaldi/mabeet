import { auth } from "@/server/auth/better-auth";

/**
 * Creates an email-and-password account whose email is already verified: the person opened the invitation sent to
 * that address, which proves it is theirs, so no separate confirmation email is sent. The same records Better
 * Auth's own sign-up writes (a user, and a "credential" account holding the hashed password).
 */
export async function createVerifiedAccount(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  locale: string;
}) {
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser(
    {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      locale: input.locale,
      emailVerified: true,
    },
    { method: "email-password" },
  );
  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await context.password.hash(input.password),
  });
  return user;
}
