import { partnerInput, partnerParams } from "@/modules/partners";
import { removePartner, updatePartner } from "@/modules/partners/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** Saves a partner place, every field at once, as its editor sends it. */
export const PATCH = adminRoute(partnerParams, async ({ request, actor, params: { partnerId } }) => {
  await updatePartner(actor, partnerId, await parseBody(request, partnerInput));
  return json({ ok: true });
});

/** Takes a partner off every page. It can be brought back. */
export const DELETE = adminRoute(partnerParams, async ({ actor, params: { partnerId } }) => {
  await removePartner(actor, partnerId);
  return json({ ok: true });
});
