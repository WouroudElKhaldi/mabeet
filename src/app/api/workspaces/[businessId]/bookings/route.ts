import { workspaceParams } from "@/lib/schemas";
import { bookingFilters } from "@/modules/bookings";
import { listBookings } from "@/modules/bookings/server";
import { json, parseQuery, tenantRoute } from "@/server/http/route";

/** The place's stays, filtered by status, room and dates, newest first. Guests' contacts are masked without guests.contact. */
export const GET = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await listBookings(ctx, parseQuery(request, bookingFilters)));
});
