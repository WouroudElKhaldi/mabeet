import { workspaceParams } from "@/lib/schemas";
import { bookingUnitInput } from "@/modules/rooms";
import { chooseBookingUnit } from "@/modules/rooms/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** Books the place room by room, or as a whole (which gives it its whole-place unit). */
export const PUT = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const { bookingUnit } = await parseBody(request, bookingUnitInput);
  return json(await chooseBookingUnit(ctx, bookingUnit));
});
