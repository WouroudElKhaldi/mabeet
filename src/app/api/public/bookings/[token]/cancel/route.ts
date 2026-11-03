import { bookingTokenParams, guestCancelInput } from "@/modules/bookings";
import { cancelStayAsGuest } from "@/modules/bookings/server";
import { notFound } from "@/server/errors";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, requireUser, route } from "@/server/http/route";

/**
 * The signed-in guest cancels their own booking: while it waits for payment or for the host, or once confirmed, and
 * before check-in. Anything paid online is refunded in full. Someone else's booking is "not found", like an unknown one.
 */
export const POST = route(async (request, context) => {
  const user = await requireUser(request);
  await enforceRateLimit(`cancel:${user.id}`, 10, 10 * 60_000);
  const { token } = await parseParams(context, bookingTokenParams);
  const { reason } = await parseBody(request, guestCancelInput);
  const booking = await cancelStayAsGuest(token, user.id, reason ?? null);
  if (!booking) throw notFound("Booking");
  return json({ status: booking.status });
});
