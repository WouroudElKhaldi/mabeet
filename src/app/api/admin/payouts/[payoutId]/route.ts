import { payoutDecisionInput, payoutParams } from "@/modules/payments";
import { decidePayout } from "@/modules/payments/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** The admin marks a payout sent, with the transfer's reference, or refuses it. Platform admins only. */
export const POST = adminRoute(payoutParams, async ({ request, actor, params: { payoutId } }) => {
  await decidePayout(actor, payoutId, await parseBody(request, payoutDecisionInput));
  return json({ ok: true });
});
