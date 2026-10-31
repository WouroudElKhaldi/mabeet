import { workspaceParams } from "@/lib/schemas";
import { roleInput } from "@/modules/team";
import { createRole, listRoles } from "@/modules/team/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listRoles(ctx));
});

export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await createRole(ctx, await parseBody(request, roleInput)), 201);
});
