import { sponsorshipParams } from "@/modules/partners";
import { endSponsorship } from "@/modules/partners/server";
import { adminRoute, json } from "@/server/http/route";

/** Ends a sponsorship: the partner stays, no longer first or marked. */
export const DELETE = adminRoute(
  sponsorshipParams,
  async ({ actor, params: { partnerId, sponsorshipId } }) => {
    await endSponsorship(actor, partnerId, sponsorshipId);
    return json({ ok: true });
  },
);
