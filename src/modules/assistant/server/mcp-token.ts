import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { auth } from "@/server/auth/better-auth";
import { MCP_READ_SCOPE, MCP_RESOURCE } from "@/server/auth/mcp-oauth";
import type { TenantContext } from "@/server/auth/tenant-context";
import { env } from "@/server/env";
import { authenticateKey } from "./api-key-service";
import { contextForToken } from "./mcp-oauth-service";

// Who is calling the host MCP: a personal key (mbt_…) made on the Connect AI page, or an OAuth access token from an AI
// app that went through sign-in, the choice of a place and consent.

const resourceClient = oauthProviderResourceClient(auth).getActions();
// Given explicitly: derived from the auth options, both would miss Better Auth's default /api/auth base path, and
// every token would be refused.
const ISSUER = new URL("/api/auth", env.BETTER_AUTH_URL).toString();
const JWKS_URL = `${ISSUER}/jwks`;

export interface McpCaller {
  ctx: TenantContext;
  /** For the rate limit. */
  rateKey: string;
  apiKeyId?: string;
}

/** Where AI apps learn how to get a token for this server (RFC 9728). */
export const MCP_RESOURCE_METADATA_URL = new URL(
  "/.well-known/oauth-protected-resource/api/mcp",
  MCP_RESOURCE,
).toString();

export async function authenticateMcpCaller(request: Request, now = new Date()): Promise<McpCaller | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return null;
  if (token.startsWith("mbt_")) {
    const key = await authenticateKey(token, now);
    return key && { ctx: key.ctx, rateKey: `mcp:${key.keyId}`, apiKeyId: key.keyId };
  }
  try {
    const payload = await resourceClient.verifyAccessTokenRequest(request, {
      verifyOptions: { audience: MCP_RESOURCE, issuer: ISSUER },
      jwksUrl: JWKS_URL,
      requiredScopes: [MCP_READ_SCOPE],
    });
    const { sub, business_id: businessId, client_id: clientId } = payload;
    if (typeof sub !== "string" || typeof businessId !== "string" || typeof clientId !== "string")
      return null;
    const ctx = await contextForToken(sub, businessId, clientId);
    return ctx && { ctx, rateKey: `mcp:oauth:${sub}:${clientId}:${businessId}` };
  } catch {
    // Expired, for another server, badly signed or missing the scope: each means "get a new token".
    return null;
  }
}

/** What /.well-known/oauth-protected-resource answers. */
export function mcpResourceMetadata() {
  return resourceClient.getProtectedResourceMetadata({
    resource: MCP_RESOURCE,
    scopes_supported: [MCP_READ_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Mabeet host MCP",
  });
}
