import { invitationParams } from "@/modules/team";
import { cancelInvitation } from "@/modules/team/server";
import { json, tenantRoute } from "@/server/http/route";

/** Cancels an invitation that is still waiting; its link stops working. */
export const DELETE = tenantRoute(invitationParams, async ({ ctx, params: { invitationId } }) => {
  await cancelInvitation(ctx, invitationId);
  return json({ ok: true });
});
