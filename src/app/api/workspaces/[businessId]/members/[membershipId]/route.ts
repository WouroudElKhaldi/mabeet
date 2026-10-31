import { memberParams, memberUpdate } from "@/modules/team";
import { changeMemberRole, removeMember } from "@/modules/team/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

export const PATCH = tenantRoute(memberParams, async ({ request, ctx, params: { membershipId } }) => {
  const { roleId } = await parseBody(request, memberUpdate);
  await changeMemberRole(ctx, membershipId, roleId);
  return json({ ok: true });
});

export const DELETE = tenantRoute(memberParams, async ({ ctx, params: { membershipId } }) => {
  await removeMember(ctx, membershipId);
  return json({ ok: true });
});
