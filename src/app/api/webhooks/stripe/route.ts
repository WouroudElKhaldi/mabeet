import { handleStripeWebhook } from "@/modules/billing/server";
import { json, route } from "@/server/http/route";

/** Stripe calls this when a subscription starts, changes or ends. The raw body is needed for the signature. */
export const POST = route(async (request) => {
  const result = await handleStripeWebhook(await request.text(), request.headers.get("stripe-signature"));
  if (result === "rejected") return json({ error: "Invalid signature" }, 400);
  return json({ received: true, duplicate: result === "duplicate" });
});
