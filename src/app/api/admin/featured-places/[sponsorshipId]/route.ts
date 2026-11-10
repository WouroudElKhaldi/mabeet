import { featureParams } from "@/modules/partners";
import { endPlaceFeature } from "@/modules/partners/server";
import { adminRoute, json } from "@/server/http/route";

/** Ends a guesthouse's featured days: it stays listed, no longer first or marked. */
export const DELETE = adminRoute(featureParams, async ({ actor, params: { sponsorshipId } }) => {
  await endPlaceFeature(actor, sponsorshipId);
  return json({ ok: true });
});
