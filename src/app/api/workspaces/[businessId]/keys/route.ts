import { workspaceParams } from "@/lib/schemas";
import { keyInput } from "@/modules/assistant";
import { createKey, listKeys } from "@/modules/assistant/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** The member's own MCP keys in this place. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await listKeys(ctx));
});

/** A new read-only key. The answer carries the secret this once; it is never shown again. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await createKey(ctx, await parseBody(request, keyInput)), 201);
});
