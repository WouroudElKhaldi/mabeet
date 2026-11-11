import { bookingCheckoutInput, bookingTokenParams } from "@/modules/bookings";
import { startBookingCheckout } from "@/modules/bookings/server";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, requireVerifiedUser, route } from "@/server/http/route";

/** The signed-in guest pays their booking, with Whish or a card. Returns the payment page to send them to. */
export const POST = route(async (request, context) => {
  const user = await requireVerifiedUser(request);
  await enforceRateLimit(`checkout:${user.id}`, 10, 10 * 60_000);
  const { token } = await parseParams(context, bookingTokenParams);
  const { method } = await parseBody(request, bookingCheckoutInput);
  return json({ url: await startBookingCheckout(token, user.id, method) });
});
