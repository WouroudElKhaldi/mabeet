import { roomParams, specialPriceInput } from "@/modules/rooms";
import { listSpecialPrices, setSpecialPrice } from "@/modules/rooms/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

export const GET = tenantRoute(roomParams, async ({ ctx, params: { roomId } }) => {
  return json(await listSpecialPrices(ctx, roomId));
});

export const PUT = tenantRoute(roomParams, async ({ request, ctx, params: { roomId } }) => {
  return json(await setSpecialPrice(ctx, roomId, await parseBody(request, specialPriceInput)));
});
