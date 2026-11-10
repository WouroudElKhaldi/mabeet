import { workspaceParams } from "@/lib/schemas";
import { offeringInput } from "@/modules/offerings";
import { createOffering, listOfferings } from "@/modules/offerings/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** The business's experiences and services, with their photos and upcoming sessions. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listOfferings(ctx));
});

/** A new experience or service, within the plan's limit. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await createOffering(ctx, await parseBody(request, offeringInput)), 201);
});
