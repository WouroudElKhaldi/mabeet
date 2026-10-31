import { whishReferenceBody } from "@/modules/payments";
import { hasWhishHeaders, readSimulatedStatus } from "@/modules/payments/server";
import { json, parseBody, route } from "@/server/http/route";

/** Simulated Whish Pay: a payment's collectStatus. */
export const POST = route(async (request) => {
  if (!hasWhishHeaders(request.headers)) return json({ status: false, code: "400", data: null });
  const { externalId } = await parseBody(request, whishReferenceBody);
  return json(await readSimulatedStatus(externalId));
});
