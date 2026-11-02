import { quoteQuery, roomParams } from "@/modules/directory";
import { quoteRoom } from "@/modules/directory/server";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseParams, parseQuery, route } from "@/server/http/route";

/** The price of a stay in a room, and whether it can be booked as asked. No sign-in: guests look before they join. */
export const GET = route(async (request, context) => {
  // The calendar asks again each time the dates change, so the limit is generous; it only stops a script.
  await enforceRateLimit(`quote:${clientAddress(request)}`, 120, 60_000);
  const { slug, roomId } = await parseParams(context, roomParams);
  const { range, guests } = parseQuery(request, quoteQuery);
  return json(await quoteRoom(slug, roomId, { range, guests }));
});
