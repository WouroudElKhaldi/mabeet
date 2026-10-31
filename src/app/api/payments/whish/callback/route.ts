import { whishCallbackQuery } from "@/modules/billing";
import { handleWhishCallback } from "@/modules/billing/server";
import { json, parseQuery, route } from "@/server/http/route";

/**
 * Whish calls this by GET after each payment attempt. The call itself proves nothing (it is unauthenticated),
 * so it only makes Mabeet ask Whish for the payment's real status. Answers 200, as Whish expects.
 */
export const GET = route(async (request) => {
  const result = await handleWhishCallback(parseQuery(request, whishCallbackQuery));
  return json({ ok: true, result });
});
