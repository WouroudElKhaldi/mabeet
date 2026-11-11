import { sessionParams } from "@/modules/offerings";
import { cancelSession } from "@/modules/bookings/server";
import { json, tenantRoute } from "@/server/http/route";

/** Takes a session off the schedule. One with guests booked on it is refused (409) until their bookings end. */
export const DELETE = tenantRoute(sessionParams, async ({ ctx, params: { sessionId } }) => {
  await cancelSession(ctx, sessionId);
  return json({ cancelled: true });
});
