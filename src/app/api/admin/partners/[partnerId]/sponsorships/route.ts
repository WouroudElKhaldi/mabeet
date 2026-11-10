import { partnerParams, sponsorshipInput } from "@/modules/partners";
import { sponsorPartner } from "@/modules/partners/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** Sponsors a partner for a set of days: it comes first near guests' stays, marked "Sponsored". */
export const POST = adminRoute(partnerParams, async ({ request, actor, params: { partnerId } }) =>
  json(await sponsorPartner(actor, partnerId, await parseBody(request, sponsorshipInput)), 201),
);
