import { businessStatusInput, platformBusinessParams } from "@/modules/workspaces";
import { setBusinessStatus } from "@/modules/workspaces/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** A platform admin suspends a business (hidden everywhere at once) or reactivates it. */
export const PATCH = adminRoute(
  platformBusinessParams,
  async ({ request, actor, params: { businessId } }) => {
    const { status } = await parseBody(request, businessStatusInput);
    await setBusinessStatus(actor, businessId, status);
    return json({ ok: true });
  },
);
