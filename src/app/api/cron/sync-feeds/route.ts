import { syncDueFeeds } from "@/modules/bookings/server";
import { json, requireCronSecret, route } from "@/server/http/route";

/** Reads the calendar links due now. The worker already does it every five minutes; this is for a manual run. */
export const POST = route(async (request) => {
  requireCronSecret(request);
  return json(await syncDueFeeds());
});
