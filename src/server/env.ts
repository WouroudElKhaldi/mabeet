import { z } from "zod";

/** An empty variable counts as unset, so a copied .env.example never fails validation and defaults still apply. */
const emptyIsUnset = <T extends z.ZodType>(type: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), type);

const optional = <T extends z.ZodType>(type: T) => emptyIsUnset(type.optional());

const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  CRON_SECRET: z.string().min(24),
  // "queue" when a worker runs beside the website (`pnpm worker`, production): slow AI work and notices go on
  // Postgres queues. "inline" (the default: local development, tests) runs them in the web process, no worker.
  JOBS_MODE: z.enum(["inline", "queue"]).default("inline"),
  // Redis for rate-limit counters, shared by every web instance (docker-compose.yml runs one). Without it (local
  // development, tests), limits are counted in this process's memory, which is only right for a single server.
  REDIS_URL: optional(z.url()),
  // In "queue" mode: AI work expected to take longer than this many seconds goes to the queue. 0 queues it all.
  JOBS_SYNC_LIMIT_SECONDS: emptyIsUnset(z.coerce.number().nonnegative().default(5)),
  DEEPSEEK_API_KEY: optional(z.string()),
  // DeepSeek prices in US dollars per million tokens (check api-docs.deepseek.com/quick_start/pricing). An empty
  // value keeps the list price; it never becomes 0, which would make every answer free and the budget endless.
  AI_INPUT_USD_PER_M: emptyIsUnset(z.coerce.number().nonnegative().default(0.28)),
  AI_OUTPUT_USD_PER_M: emptyIsUnset(z.coerce.number().nonnegative().default(0.42)),
  // Monthly AI spend cap in US dollars, $50 unless set. Admins get an email at 80%; at 100% the assistants
  // pause until next month.
  AI_MONTHLY_BUDGET_USD: emptyIsUnset(z.coerce.number().positive().default(50)),
  // Email through Resend. Without a key, emails are logged instead of sent (local development).
  RESEND_API_KEY: optional(z.string()),
  // Stripe, for host plans. Without the secret key, /pricing shows the plans with checkout turned off.
  STRIPE_SECRET_KEY: optional(z.string().startsWith("sk_")),
  STRIPE_WEBHOOK_SECRET: optional(z.string().startsWith("whsec_")),
  STRIPE_PRICE_PRO: optional(z.string().startsWith("price_")),
  STRIPE_PRICE_BUSINESS: optional(z.string().startsWith("price_")),
  // Whish Pay, Mabeet's own Whish account, for guests paying online and hosts paying for plans.
  // "simulator" runs a stand-in Whish server inside the app (no keys needed); "sandbox" and "production" call
  // Whish with the channel, secret and website URL Whish issues.
  WHISH_MODE: z.enum(["simulator", "sandbox", "production"]).default("simulator"),
  WHISH_CHANNEL: optional(z.string()),
  WHISH_SECRET: optional(z.string()),
  WHISH_WEBSITE_URL: optional(z.string()),
  EMAIL_FROM: z.string().default("Mabeet <onboarding@resend.dev>"),
  // Web push to phones (`pnpm exec web-push generate-vapid-keys` makes a pair). Without them, the "notify me"
  // buttons stay hidden.
  VAPID_PUBLIC_KEY: optional(z.string()),
  VAPID_PRIVATE_KEY: optional(z.string()),
  VAPID_SUBJECT: z.string().default("mailto:hello@mabeet.app"),
  // Cloudflare R2 for uploaded photos (a public bucket behind R2_PUBLIC_URL). Without them, uploads are kept in
  // Postgres, as in local development and tests.
  R2_ACCOUNT_ID: optional(z.string()),
  R2_ACCESS_KEY_ID: optional(z.string()),
  R2_SECRET_ACCESS_KEY: optional(z.string()),
  R2_PUBLIC_BUCKET: optional(z.string()),
  R2_PUBLIC_URL: optional(z.url()),
});

export const env = schema.parse(process.env);
