import { connectionParams } from "@/modules/assistant";
import { disconnectApp } from "@/modules/assistant/server";
import { json, tenantRoute } from "@/server/http/route";

/** Disconnects one of the member's AI apps from this place: its next call is refused. */
export const DELETE = tenantRoute(connectionParams, async ({ ctx, params: { connectionId } }) => {
  await disconnectApp(ctx, connectionId);
  return json({ ok: true });
});
