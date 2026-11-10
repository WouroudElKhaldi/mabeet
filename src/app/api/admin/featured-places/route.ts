import { z } from "zod";
import { featureInput } from "@/modules/partners";
import { featurePlace, listFeaturedPlacesForAdmin } from "@/modules/partners/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** The guesthouses featured from today on. Platform admins only. */
export const GET = adminRoute(z.object({}), async ({ actor }) =>
  json(await listFeaturedPlacesForAdmin(actor)),
);

/** Features a guesthouse for a set of days: first in search and on the home page, marked "Featured". */
export const POST = adminRoute(z.object({}), async ({ request, actor }) =>
  json(await featurePlace(actor, await parseBody(request, featureInput)), 201),
);
