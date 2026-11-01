import { roomParams, roomUpdate } from "@/modules/rooms";
import { getRoom, updateRoom } from "@/modules/rooms/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

export const GET = tenantRoute(roomParams, async ({ ctx, params: { roomId } }) => {
  return json(await getRoom(ctx, roomId));
});

export const PATCH = tenantRoute(roomParams, async ({ request, ctx, params: { roomId } }) => {
  return json(await updateRoom(ctx, roomId, await parseBody(request, roomUpdate)));
});
