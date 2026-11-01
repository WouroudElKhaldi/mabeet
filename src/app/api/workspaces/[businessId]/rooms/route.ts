import { workspaceParams } from "@/lib/schemas";
import { roomInput } from "@/modules/rooms";
import { createRoom, listRooms } from "@/modules/rooms/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listRooms(ctx));
});

export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await createRoom(ctx, await parseBody(request, roomInput)), 201);
});
