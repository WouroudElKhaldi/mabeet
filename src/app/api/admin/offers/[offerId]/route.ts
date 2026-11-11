import { offerParams } from "@/modules/billing";
import { endOffer } from "@/modules/billing/server";
import { adminRoute, json } from "@/server/http/route";

/** Ends an offer now. A free plan already taken runs to its end, and payments made under it stay as they were. */
export const DELETE = adminRoute(offerParams, async ({ actor, params: { offerId } }) => {
  await endOffer(actor, offerId);
  return json({ ok: true });
});
