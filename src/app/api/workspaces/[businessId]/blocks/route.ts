import { workspaceParams } from "@/lib/schemas";
import { blockInput } from "@/modules/bookings";
import { addBlock } from "@/modules/bookings/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** Closes a room's nights by hand: for maintenance, or a booking taken by phone. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await addBlock(ctx, await parseBody(request, blockInput)), 201);
});
