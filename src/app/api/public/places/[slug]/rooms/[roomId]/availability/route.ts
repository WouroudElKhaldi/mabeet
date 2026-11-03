import { availabilityQuery, roomParams } from "@/modules/directory";
import { getRoomAvailability } from "@/modules/directory/server";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseParams, parseQuery, route } from "@/server/http/route";

/** The nights a room cannot be booked, dates only: never who stays or why. No sign-in: guests look before they join. */
export const GET = route(async (request, context) => {
  await enforceRateLimit(`availability:${clientAddress(request)}`, 120, 60_000);
  const { slug, roomId } = await parseParams(context, roomParams);
  const { range } = parseQuery(request, availabilityQuery);
  return json(await getRoomAvailability(slug, roomId, range));
});
