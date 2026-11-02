import { bookingRequestInput, placeParams } from "@/modules/bookings";
import { requestBooking } from "@/modules/bookings/server";
import { requestLocale } from "@/server/http/error-i18n";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, requireUser, route } from "@/server/http/route";

/**
 * A signed-in guest asks for a stay, and the room is held for them at once. Who they are comes from their session,
 * never from the body. A few requests every ten minutes is plenty for a person; it only stops a script from holding
 * a place's rooms.
 */
export const POST = route(async (request, context) => {
  const user = await requireUser(request);
  await enforceRateLimit(`book:${user.id}`, 10, 10 * 60_000);
  const { slug } = await parseParams(context, placeParams);
  const input = await parseBody(request, bookingRequestInput);
  const booking = await requestBooking({
    ...input,
    businessSlug: slug,
    guestUserId: user.id,
    locale: requestLocale(request),
  });
  // Only what the guest needs to go on: the link to their booking, and where it stands.
  return json(
    { publicToken: booking.publicToken, reference: booking.reference, status: booking.status },
    201,
  );
});
