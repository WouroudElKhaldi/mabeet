import { bookingParams } from "@/modules/bookings";
import { listBookingPayments } from "@/modules/bookings/server";
import { json, tenantRoute } from "@/server/http/route";

/** A stay's payments and refunds. Owners only: money is not a permission. */
export const GET = tenantRoute(bookingParams, async ({ ctx, params: { bookingId } }) => {
  return json(await listBookingPayments(ctx, bookingId));
});
