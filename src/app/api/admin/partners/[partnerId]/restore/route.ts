import { partnerParams } from "@/modules/partners";
import { restorePartner } from "@/modules/partners/server";
import { adminRoute, json } from "@/server/http/route";

/** Brings back a removed partner, with the sponsorships it had. */
export const POST = adminRoute(partnerParams, async ({ actor, params: { partnerId } }) => {
  await restorePartner(actor, partnerId);
  return json({ ok: true });
});
