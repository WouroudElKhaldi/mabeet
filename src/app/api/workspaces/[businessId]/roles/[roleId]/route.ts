import { roleInput, roleParams } from "@/modules/team";
import { deleteRole, updateRole } from "@/modules/team/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

export const PATCH = tenantRoute(roleParams, async ({ request, ctx, params: { roleId } }) => {
  await updateRole(ctx, roleId, await parseBody(request, roleInput.partial()));
  return json({ ok: true });
});

export const DELETE = tenantRoute(roleParams, async ({ ctx, params: { roleId } }) => {
  await deleteRole(ctx, roleId);
  return json({ ok: true });
});
