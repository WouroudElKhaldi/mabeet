import { keyParams } from "@/modules/assistant";
import { revokeKey } from "@/modules/assistant/server";
import { json, tenantRoute } from "@/server/http/route";

/** Revokes one of the member's keys: any AI app using it stops working at once. */
export const DELETE = tenantRoute(keyParams, async ({ ctx, params: { keyId } }) => {
  await revokeKey(ctx, keyId);
  return json({ ok: true });
});
