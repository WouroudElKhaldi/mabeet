import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/server/env";
import { unavailable } from "@/server/errors";

// A small Stripe client over its REST API: plan checkout, the billing portal, and webhook signatures. No SDK, so
// there is nothing extra to keep up to date.

const API = "https://api.stripe.com/v1";
const TIMEOUT_MS = 20_000;
/** Stripe's recommended window for webhook timestamps, against replayed events. */
const SIGNATURE_TOLERANCE_S = 300;
const NOT_AVAILABLE = "Payments are not available right now. Please try again shortly.";

export const stripeEnabled = () => Boolean(env.STRIPE_SECRET_KEY);

/** Stripe takes form-encoded bodies with bracketed keys, e.g. line_items[0][price]. */
function formBody(fields: Record<string, string | number | undefined>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) body.set(key, String(value));
  return body.toString();
}

async function post<T extends z.ZodType>(
  path: string,
  fields: Record<string, string | number | undefined>,
  schema: T,
): Promise<z.infer<T>> {
  if (!env.STRIPE_SECRET_KEY) throw unavailable("Payments are not set up yet.");
  // A timeout or a network failure is an outage like any other: a calm 503, never an internal error.
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: formBody(fields),
  }).catch((error: unknown) => {
    console.error("Stripe unreachable", error);
    throw unavailable(NOT_AVAILABLE);
  });
  if (!response.ok) {
    console.error("Stripe error", response.status, await response.text().catch(() => ""));
    throw unavailable(NOT_AVAILABLE);
  }
  return schema.parse(await response.json());
}

const urlResult = z.object({ url: z.string() });

/** A Stripe Checkout page for a plan subscription. The business id travels with it, so the webhook knows whose it is. */
export function createSubscriptionCheckout(input: {
  priceId: string;
  businessId: string;
  customerId: string | null;
  email: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return post(
    "/checkout/sessions",
    {
      mode: "subscription",
      "line_items[0][price]": input.priceId,
      "line_items[0][quantity]": 1,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.businessId,
      customer: input.customerId ?? undefined,
      customer_email: input.customerId ? undefined : input.email,
      "metadata[businessId]": input.businessId,
      "subscription_data[metadata][businessId]": input.businessId,
    },
    urlResult,
  );
}

export function createBillingPortalSession(customerId: string, returnUrl: string) {
  return post("/billing_portal/sessions", { customer: customerId, return_url: returnUrl }, urlResult);
}

/**
 * Checks the Stripe-Signature header: HMAC-SHA256 of "timestamp.body" with the webhook secret, compared in
 * constant time, and a timestamp within five minutes. Returns false for anything that does not match.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now = Date.now(),
): boolean {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.split("=") as [string, string | undefined]);
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - timestamp) > SIGNATURE_TOLERANCE_S) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"));
  return signatures.some((signature) => {
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** The parts of a Stripe event this app reads. Unknown fields are ignored. */
export const stripeEvent = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z
      .object({
        id: z.string(),
        customer: z.string().nullish(),
        subscription: z.string().nullish(),
        client_reference_id: z.string().nullish(),
        status: z.string().optional(),
        /** Checkout sessions: "subscription" for plans. */
        mode: z.string().optional(),
        /** Invoices: what the host paid for their plan. */
        amount_paid: z.number().optional(),
        currency: z.string().optional(),
        lines: z
          .object({
            data: z.array(
              z
                .object({
                  pricing: z.object({ price_details: z.object({ price: z.string() }).nullish() }).nullish(),
                  price: z.object({ id: z.string() }).nullish(),
                })
                .loose(),
            ),
          })
          .optional(),
        current_period_end: z.number().optional(),
        cancel_at: z.number().nullish(),
        metadata: z.record(z.string(), z.string()).optional(),
        items: z
          .object({
            data: z.array(
              // Newer API versions put the billing period on each item instead of the subscription.
              z.object({ price: z.object({ id: z.string() }), current_period_end: z.number().optional() }),
            ),
          })
          .optional(),
      })
      .loose(),
  }),
});
export type StripeEvent = z.infer<typeof stripeEvent>;
