import { listMyTrips } from "@/modules/directory/server";
import { json, requireUser, route } from "@/server/http/route";

/** The signed-in guest's own stays, newest first. Nobody else's, and nothing about payments or contact details. */
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return json(await listMyTrips(user.id));
});
