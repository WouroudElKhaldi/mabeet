import { runHousekeeping } from "@/modules/housekeeping/server";
import { json, requireCronSecret, route } from "@/server/http/route";

/** Runs housekeeping now. The worker already runs it every five minutes; this is for a manual or outside trigger. */
export const POST = route(async (request) => {
  requireCronSecret(request);
  return json(await runHousekeeping());
});
