import { z } from "zod";
import { offerInput, offersQuery } from "@/modules/billing";
import { createOffer, listOffersForAdmin } from "@/modules/billing/server";
import { adminRoute, json, parseBody, parseQuery } from "@/server/http/route";

/** One page of the plan offers, newest first, ended ones too, with how much each was used. Platform admins only. */
export const GET = adminRoute(z.object({}), async ({ request, actor }) => {
  const { page, ...filters } = parseQuery(request, offersQuery);
  return json(await listOffersForAdmin(actor, filters, page));
});

/** Adds a plan offer: free or a share off, for every place or one, for the first months or between two dates. */
export const POST = adminRoute(z.object({}), async ({ request, actor }) =>
  json(await createOffer(actor, await parseBody(request, offerInput)), 201),
);
