import { offeringParams, offeringUpdate } from "@/modules/offerings";
import { updateOffering } from "@/modules/offerings/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** Changes the fields sent. `active: false` takes it off the site without removing it. */
export const PATCH = tenantRoute(offeringParams, async ({ request, ctx, params: { offeringId } }) => {
  return json(await updateOffering(ctx, offeringId, await parseBody(request, offeringUpdate)));
});
