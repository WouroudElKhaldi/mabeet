import { workspaceParams } from "@/lib/schemas";
import { listMembers } from "@/modules/team/server";
import { json, tenantRoute } from "@/server/http/route";

// New members join through invitations (../invitations).
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listMembers(ctx));
});
