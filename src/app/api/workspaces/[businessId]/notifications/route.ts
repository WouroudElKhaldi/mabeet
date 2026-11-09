import { getLatestBusinessNotifications, markSeen } from "@/modules/notifications/server";
import { workspaceParams } from "@/lib/schemas";
import { json, tenantRoute } from "@/server/http/route";

/** The bell's card: the latest five notifications in this business, and when the person last read them. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  const { items, seenAt } = await getLatestBusinessNotifications(ctx);
  return json({ items, seenAt });
});

/** Opening the bell marks everything up to now as read. */
export const POST = tenantRoute(workspaceParams, async ({ ctx }) => {
  await markSeen(ctx.userId);
  return json({ ok: true });
});
