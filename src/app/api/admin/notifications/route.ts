import { z } from "zod";
import { getLatestPlatformNotifications, markSeen } from "@/modules/notifications/server";
import { adminRoute, json } from "@/server/http/route";

/** The admin bell's card: the latest five platform notifications. Platform admins only. */
export const GET = adminRoute(z.object({}), async ({ actor }) => {
  const { items, seenAt } = await getLatestPlatformNotifications(actor);
  return json({ items, seenAt });
});

/** Opening the bell marks everything up to now as read. */
export const POST = adminRoute(z.object({}), async ({ actor }) => {
  await markSeen(actor.userId);
  return json({ ok: true });
});
