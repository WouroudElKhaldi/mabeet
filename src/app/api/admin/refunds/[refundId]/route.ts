import { refundParams, refundSentInput } from "@/modules/bookings";
import { markRefundSent } from "@/modules/bookings/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** The admin sent a refund by hand (one a provider kept refusing). Platform admins only. */
export const POST = adminRoute(refundParams, async ({ request, actor, params: { refundId } }) => {
  const { reference } = await parseBody(request, refundSentInput);
  await markRefundSent(actor, refundId, reference ?? null);
  return json({ ok: true });
});
