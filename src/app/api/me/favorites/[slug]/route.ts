import { placeParams } from "@/modules/bookings";
import { setFavorite } from "@/modules/directory/server";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseParams, requireUser, route } from "@/server/http/route";

/** Keeps a place on the signed-in guest's list. Saving one they already saved changes nothing. */
export const PUT = route(async (request, context) => {
  const user = await requireUser(request);
  await enforceRateLimit(`favorites:${user.id}`, 120, 60_000);
  const { slug } = await parseParams(context, placeParams);
  await setFavorite(user.id, slug, true);
  return json({ saved: true });
});

/** Takes a place off the list. Removing one that is not on it changes nothing. */
export const DELETE = route(async (request, context) => {
  const user = await requireUser(request);
  await enforceRateLimit(`favorites:${user.id}`, 120, 60_000);
  const { slug } = await parseParams(context, placeParams);
  await setFavorite(user.id, slug, false);
  return json({ saved: false });
});
