import { buildRoomCalendar } from "@/modules/bookings/server";
import { exportTokenParams } from "@/modules/calendar-sync";
import { parseParams, route } from "@/server/http/route";

/**
 * A room's calendar link, read by Airbnb and Booking.com: its taken nights as iCal, with no guest details. No
 * sign-in; the secret in the address is the key. Never cached, so a platform always reads the nights as they are.
 */
export const GET = route(async (_request, context) => {
  const { token } = await parseParams(context, exportTokenParams);
  return new Response(await buildRoomCalendar(token), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": 'inline; filename="calendar.ics"',
    },
  });
});
