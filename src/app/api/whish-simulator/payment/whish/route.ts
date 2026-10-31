import { whishCreateBody } from "@/modules/payments";
import { createSimulatedPayment, hasWhishHeaders } from "@/modules/payments/server";
import { json, parseBody, route } from "@/server/http/route";

/** Simulated Whish Pay: create a payment and get its collectUrl. Answers HTTP 200 with Whish's envelope. */
export const POST = route(async (request) => {
  if (!hasWhishHeaders(request.headers)) return json({ status: false, code: "400", data: null });
  return json(await createSimulatedPayment(await parseBody(request, whishCreateBody)));
});
