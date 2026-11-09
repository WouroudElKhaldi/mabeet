import { syncFeedNow } from "@/modules/bookings/server";
import { feedParams } from "@/modules/calendar-sync";
import { json, tenantRoute } from "@/server/http/route";

/** "Sync now": reads the calendar link at once. A link that fails answers 200 with its error, as it is saved. */
export const POST = tenantRoute(feedParams, async ({ ctx, params: { feedId } }) => {
  return json(await syncFeedNow(ctx, feedId));
});
