import { adminPlanInput } from "@/modules/billing";
import { setPlanAsAdmin } from "@/modules/billing/server";
import { platformBusinessParams } from "@/modules/workspaces";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** A platform admin sets a place's plan by hand: until a last day, or with no end. Not for a place paying by card. */
export const PATCH = adminRoute(platformBusinessParams, async ({ request, actor, params: { businessId } }) =>
  json(await setPlanAsAdmin(actor, businessId, await parseBody(request, adminPlanInput))),
);
