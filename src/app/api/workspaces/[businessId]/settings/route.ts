import { workspaceParams } from "@/lib/schemas";
import { settingsInput } from "@/modules/workspaces";
import { getSettings, updateSettings } from "@/modules/workspaces/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** The place's settings, for the settings screen. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await getSettings(ctx));
});

/** Changes the fields sent. Choosing how guests book and pay is the owner's. */
export const PATCH = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await updateSettings(ctx, await parseBody(request, settingsInput)));
});
