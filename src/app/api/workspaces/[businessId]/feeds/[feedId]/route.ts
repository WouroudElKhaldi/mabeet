import { disconnectFeed } from "@/modules/bookings/server";
import { feedParams } from "@/modules/calendar-sync";
import { json, tenantRoute } from "@/server/http/route";

/** Disconnects a calendar link; the nights it brought are free again. */
export const DELETE = tenantRoute(feedParams, async ({ ctx, params: { feedId } }) => {
  await disconnectFeed(ctx, feedId);
  return json({ ok: true });
});
