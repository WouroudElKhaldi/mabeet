import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/server/db/client";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/server/email/auth-emails";
import { emailReachesEveryone } from "@/server/email/send";
import { env } from "@/server/env";

// Email and password sign-in on the existing User, Session, Account and Verification tables. Sessions live in
// Postgres, so signing out or resetting a password ends them everywhere.

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Only demand a verified email once it can actually reach people (a key and a verified sending domain).
    requireEmailVerification: emailReachesEveryone(),
    sendResetPassword: ({ user, url }) =>
      sendPasswordResetEmail(user.email, user.name, url, (user as { locale?: string }).locale),
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: ({ user, url }) =>
      sendVerificationEmail(user.email, user.name, url, (user as { locale?: string }).locale),
  },
  user: {
    additionalFields: {
      platformRole: { type: "string", input: false, defaultValue: "USER" },
      phone: { type: "string", required: false },
      // Set at sign-up from the language the person is using, so their emails come in it.
      locale: { type: "string", required: false, defaultValue: "en" },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
  plugins: [nextCookies()],
});
