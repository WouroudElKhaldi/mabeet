import { workspaceParams } from "@/lib/schemas";
import { openBillingPortal } from "@/modules/billing/server";
import { json, tenantRoute } from "@/server/http/route";

/** Stripe's billing portal, to change plan, update the card or cancel. Owners only. */
export const POST = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json({ url: await openBillingPortal(ctx) });
});
