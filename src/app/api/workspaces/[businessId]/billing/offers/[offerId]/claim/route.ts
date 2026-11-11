import { claimOfferParams } from "@/modules/billing";
import { claimFreeOffer } from "@/modules/billing/server";
import { json, tenantRoute } from "@/server/http/route";

/** The owner takes a free plan offer: the place is on its plan until the offer ends for it. */
export const POST = tenantRoute(claimOfferParams, async ({ ctx, params: { offerId } }) =>
  json(await claimFreeOffer(ctx, offerId)),
);
