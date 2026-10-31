import { workspaceParams } from "@/lib/schemas";
import { invitationInput } from "@/modules/team";
import { inviteMember, listTeamInvitations } from "@/modules/team/server";
import { requestLocale } from "@/server/http/error-i18n";
import { json, parseBody, tenantRoute } from "@/server/http/route";

export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listTeamInvitations(ctx));
});

/** Invites someone to the team with a role; the link lets them join with exactly that role. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const input = await parseBody(request, invitationInput);
  return json(await inviteMember(ctx, input, requestLocale(request)), 201);
});
