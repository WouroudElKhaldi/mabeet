import { pushEndpointInput, pushSubscriptionInput } from "@/modules/notifications";
import { followOnDevice, unfollowDevice } from "@/modules/notifications/server";
import { json, parseBody, requireUser, route } from "@/server/http/route";
import { enforceRateLimit } from "@/server/http/rate-limit";

const CHANGES_PER_HOUR = 20;

/** Turns push on for this device, for the signed-in person. */
export const POST = route(async (request) => {
  const user = await requireUser(request);
  await enforceRateLimit(`push:${user.id}`, CHANGES_PER_HOUR, 3_600_000);
  const { endpoint, keys } = await parseBody(request, pushSubscriptionInput);
  await followOnDevice(user.id, { endpoint, ...keys });
  return json({ ok: true });
});

/** Turns push off for this device. */
export const DELETE = route(async (request) => {
  const user = await requireUser(request);
  const { endpoint } = await parseBody(request, pushEndpointInput);
  await unfollowDevice(user.id, endpoint);
  return json({ ok: true });
});
