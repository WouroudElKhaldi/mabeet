import { bookingParams } from "@/modules/bookings";
import { getBooking } from "@/modules/bookings/server";
import { json, tenantRoute } from "@/server/http/route";

/** One stay of the place. */
export const GET = tenantRoute(bookingParams, async ({ ctx, params: { bookingId } }) => {
  return json(await getBooking(ctx, bookingId));
});
