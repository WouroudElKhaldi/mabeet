import { workspaceParams } from "@/lib/schemas";
import { analyticsQuery } from "@/modules/analytics";
import { getBusinessReport } from "@/modules/analytics/server";
import { json, parseQuery, tenantRoute } from "@/server/http/route";

/** The place's numbers over a period (the last 30 days unless asked): occupancy, revenue, commission saved, channels. */
export const GET = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await getBusinessReport(ctx, parseQuery(request, analyticsQuery)));
});
