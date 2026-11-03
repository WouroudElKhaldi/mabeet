import { env } from "@/server/env";
import { resolveContext } from "./resolve-context";
import { can } from "./tenant-context";

// Connecting an AI app with OAuth instead of a key. These pieces live in the shared kernel, not the assistant module,
// because Better Auth's own setup needs them: which server the tokens are for, and whether the place picked while
// signing in may still be connected.

/** The host MCP server, as the OAuth "resource" its tokens are issued for. */
export const MCP_RESOURCE = new URL("/api/mcp", env.BETTER_AUTH_URL).toString();

/** The host MCP only reads for now, like every key, so reading is the only access an AI app can ask for. */
export const MCP_READ_SCOPE = "mcp:read";

/** Whether this person may connect an AI app to this place: an active member there, allowed to use AI apps. */
export async function mayConnectAi(userId: string, businessId: string): Promise<boolean> {
  const ctx = await resolveContext(userId, businessId, "mcp");
  return ctx !== null && can(ctx, "ai.use");
}

/** The place picked on this sign-in session, if the person may still connect to it; otherwise null. */
export async function pickedWorkspace(userId: string, businessId: unknown): Promise<string | null> {
  if (typeof businessId !== "string" || !businessId) return null;
  return (await mayConnectAi(userId, businessId)) ? businessId : null;
}
