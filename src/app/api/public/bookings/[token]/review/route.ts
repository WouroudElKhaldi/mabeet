import { bookingTokenParams } from "@/modules/bookings";
import { newReview } from "@/modules/reviews";
import { writeReview } from "@/modules/reviews/server";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, requireUser, route } from "@/server/http/route";

/**
 * The guest's review of their own stay, from their trips. The booking's private link says which stay; the service
 * checks it was theirs, that it went ahead, and that it is over.
 */
export const POST = route(async (request, context) => {
  const user = await requireUser(request);
  await enforceRateLimit(`review:${user.id}`, 10, 10 * 60_000);
  const { token } = await parseParams(context, bookingTokenParams);
  const input = await parseBody(request, newReview);
  await writeReview(user.id, token, input);
  return json({ written: true }, 201);
});
