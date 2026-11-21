import { adminPlanInput, hostParams } from "@/modules/billing";
import { setPlanAsAdmin } from "@/modules/billing/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/**
 * A platform admin sets a host's plan by hand, for all their places: until a last day, or with no end. Not for a
 * host paying by card.
 */
export const PATCH = adminRoute(hostParams, async ({ request, actor, params: { userId } }) =>
  json(await setPlanAsAdmin(actor, userId, await parseBody(request, adminPlanInput))),
);
