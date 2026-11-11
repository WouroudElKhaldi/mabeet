import { experienceParams, sessionBookingRequestInput } from "@/modules/bookings";
import { requestSessionBooking } from "@/modules/bookings/server";
import { requestLocale } from "@/server/http/error-i18n";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, requireVerifiedUser, route } from "@/server/http/route";

/**
 * A signed-in guest asks for seats in a session of an experience or service, and they are held for them at once.
 * Shares the stay requests' limit: it only stops a script from holding a host's seats.
 */
export const POST = route(async (request, context) => {
  const user = await requireVerifiedUser(request);
  await enforceRateLimit(`book:${user.id}`, 10, 10 * 60_000);
  const { slug } = await parseParams(context, experienceParams);
  const input = await parseBody(request, sessionBookingRequestInput);
  const booking = await requestSessionBooking({
    ...input,
    offeringSlug: slug,
    guestUserId: user.id,
    locale: requestLocale(request),
  });
  // Only what the guest needs to go on: the link to their booking, and where it stands.
  return json(
    { publicToken: booking.publicToken, reference: booking.reference, status: booking.status },
    201,
  );
});
