import { workspaceParams } from "@/lib/schemas";
import { checkoutInput } from "@/modules/billing";
import { startCheckout } from "@/modules/billing/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** Starts Stripe Checkout for a paid plan. Owners only; returns the page to send them to. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const { plan } = await parseBody(request, checkoutInput);
  return json({ url: await startCheckout(ctx, plan) });
});
