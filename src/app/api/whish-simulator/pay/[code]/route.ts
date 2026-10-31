import { whishPayInput, whishPayParams } from "@/modules/payments";
import { paySimulatedPayment } from "@/modules/payments/server";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, route } from "@/server/http/route";

/** The simulated Whish payment page's "Pay" button: phone and one-time code. */
export const POST = route(async (request, context) => {
  await enforceRateLimit(`whish-sim:${clientAddress(request)}`, 30, 10 * 60_000);
  const { code } = await parseParams(context, whishPayParams);
  const { phone, otp } = await parseBody(request, whishPayInput);
  return json(await paySimulatedPayment(code, phone, otp));
});
