import { workspaceParams } from "@/lib/schemas";
import { placeArchiveInput } from "@/modules/workspaces";
import { setPlaceArchived } from "@/modules/workspaces/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** The owner archives the place (closed to guests, kept for the team) or brings it back. */
export const PUT = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const { archived } = await parseBody(request, placeArchiveInput);
  await setPlaceArchived(ctx, archived);
  return json({ archived });
});
