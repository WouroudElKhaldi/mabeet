import { blockParams } from "@/modules/bookings";
import { removeBlock } from "@/modules/bookings/server";
import { json, tenantRoute } from "@/server/http/route";

/** Reopens nights closed by hand. */
export const DELETE = tenantRoute(blockParams, async ({ ctx, params: { blockId } }) => {
  await removeBlock(ctx, blockId);
  return json({ ok: true });
});
