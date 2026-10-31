import { invitationToken } from "@/modules/team";
import { acceptInvitation } from "@/modules/team/server";
import { json, parseParams, requireUser, route } from "@/server/http/route";

/** A signed-in person accepts an invitation sent to their email and joins the team with its role. */
export const POST = route(async (request, context) => {
  const user = await requireUser(request);
  const { token } = await parseParams(context, invitationToken);
  return json(await acceptInvitation(user, token));
});
