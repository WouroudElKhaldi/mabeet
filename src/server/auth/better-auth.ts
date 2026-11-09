import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { prisma } from "@/server/db/client";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/server/email/auth-emails";
import { emailReachesEveryone } from "@/server/email/send";
import { env } from "@/server/env";
import { MCP_READ_SCOPE, MCP_RESOURCE, pickedWorkspace } from "./mcp-oauth";
import { PASSWORD_MIN_LENGTH } from "@/config/passwords";

// Email and password sign-in on the existing User, Session, Account and Verification tables. Sessions live in
// Postgres, so signing out or resetting a password ends them everywhere. AI apps connect to the host MCP with
// OAuth on the same accounts.

const OAUTH_SCOPES = ["openid", "profile", "email", "offline_access", MCP_READ_SCOPE];

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // The jwt plugin's session-to-JWT endpoint is not needed: AI apps get their tokens through OAuth.
  disabledPaths: ["/token"],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
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
    additionalFields: { mcpBusinessId: { type: "string", required: false, input: false } },
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
  plugins: [
    jwt(),
    // AI apps (MCP clients) connect with OAuth: sign in, pick a place, allow access. Tokens act as that member, in
    // that place (see mcp-token.ts in the assistant module).
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/oauth/consent",
      scopes: OAUTH_SCOPES,
      resources: [{ identifier: MCP_RESOURCE, name: "Mabeet host MCP", allowedScopes: OAUTH_SCOPES }],
      // MCP clients register themselves; PKCE keeps a stolen authorization code useless.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationRequirePKCE: true,
      clientRegistrationDefaultScopes: [MCP_READ_SCOPE],
      clientRegistrationAllowedScopes: OAUTH_SCOPES,
      clientRegistrationDefaultApplicationType: "infer",
      // Every registered app may ask for tokens for the MCP server, and only for it.
      clientRegistrationDefaultResources: [MCP_RESOURCE],
      clientRegistrationAllowedResources: [MCP_RESOURCE],
      postLogin: {
        page: "/oauth/workspace",
        // Always ask which place, every time an app connects; continue once one the person may connect is picked.
        shouldRedirect: async ({ user, session, isContinuation }) =>
          !(isContinuation && (await pickedWorkspace(user.id, session.mcpBusinessId))),
        consentReferenceId: async ({ user, session }) => {
          const businessId = await pickedWorkspace(user.id, session.mcpBusinessId);
          if (!businessId) throw new Error("Pick a place first");
          return businessId;
        },
      },
      customAccessTokenClaims: ({ referenceId }) => (referenceId ? { business_id: referenceId } : {}),
    }),
    nextCookies(),
  ],
});
