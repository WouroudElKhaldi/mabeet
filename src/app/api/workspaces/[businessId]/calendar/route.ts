import { workspaceParams } from "@/lib/schemas";
import { calendarQuery } from "@/modules/bookings";
import { getCalendar } from "@/modules/bookings/server";
import { json, parseQuery, tenantRoute } from "@/server/http/route";

/** Every taken night of the place in a window (six weeks from today by default): bookings, closed dates, platform stays. */
export const GET = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await getCalendar(ctx, parseQuery(request, calendarQuery)));
});
