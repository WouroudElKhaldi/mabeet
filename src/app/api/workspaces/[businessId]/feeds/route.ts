import { workspaceParams } from "@/lib/schemas";
import { connectFeed, getCalendarLinks } from "@/modules/bookings/server";
import { feedInput } from "@/modules/calendar-sync";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** Each room's own calendar link, and the Airbnb, Booking.com or other links it reads. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json({ rooms: await getCalendarLinks(ctx) });
});

/** Connects a room to a platform's calendar link, and reads it at once. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await connectFeed(ctx, await parseBody(request, feedInput)), 201);
});
