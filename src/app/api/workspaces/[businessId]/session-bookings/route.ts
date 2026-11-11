import { workspaceParams } from "@/lib/schemas";
import { sessionBookingFilters } from "@/modules/bookings";
import { listSessionBookings } from "@/modules/bookings/server";
import { json, parseQuery, tenantRoute } from "@/server/http/route";

/** Seats booked in the business's sessions, by when the session starts. */
export const GET = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await listSessionBookings(ctx, parseQuery(request, sessionBookingFilters)));
});
