import { workspaceParams } from "@/lib/schemas";
import { hostProfileInput } from "@/modules/workspaces";
import { getMyHostProfile, saveMyHostProfile } from "@/modules/workspaces/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** The owner's own host profile, shared by all their places; null before the first save. Owners only. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => json(await getMyHostProfile(ctx)));

/** Saves it. Guests see it on every place the person owns, only while showOnListings is on. */
export const PUT = tenantRoute(workspaceParams, async ({ request, ctx }) =>
  json(await saveMyHostProfile(ctx, await parseBody(request, hostProfileInput))),
);
