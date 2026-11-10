import { offeringParams, sessionsInput } from "@/modules/offerings";
import { scheduleSessions } from "@/modules/offerings/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** One session on each date, all at the same local time where the business is. */
export const POST = tenantRoute(offeringParams, async ({ request, ctx, params: { offeringId } }) => {
  return json(await scheduleSessions(ctx, offeringId, await parseBody(request, sessionsInput)), 201);
});
