import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as protectedResource from "@/app/.well-known/oauth-protected-resource/api/mcp/route";
import * as authServer from "@/app/.well-known/oauth-authorization-server/api/auth/route";
import * as hostMcpRoute from "@/app/api/mcp/route";
import * as workspaceRoute from "@/app/api/oauth/workspace/route";
import * as connectedAppRoute from "@/app/api/workspaces/[businessId]/connected-apps/[connectionId]/route";
import { removeMember } from "@/modules/team/server";
import { auth } from "@/server/auth/better-auth";
import { MCP_RESOURCE } from "@/server/auth/mcp-oauth";
import { env } from "@/server/env";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { chooseWorkspace, disconnectApp, listConnectableWorkspaces, listConnectedApps } from "../server";

// Connecting an AI app by signing in: the place picked must be one the member may connect, the token acts as that
// member there and only reads, and it stops when they leave, lose the right, or disconnect the app.

const ISSUER = new URL("/api/auth", env.BETTER_AUTH_URL).toString();
const JWKS_URL = `${ISSUER}/jwks`;

/** An app that registered itself, as an MCP client does. */
async function registerApp(name = "ChatGPT") {
  const clientId = `client-${randomUUID()}`;
  await prisma.oauthClient.create({
    data: { id: randomUUID(), clientId, name, redirectUris: ["http://localhost:6274/callback"] },
  });
  return clientId;
}

/** The consent saved when the member presses Allow, for one place. */
function allow(userId: string, clientId: string, businessId: string) {
  const now = new Date();
  return prisma.oauthConsent.create({
    data: {
      id: randomUUID(),
      clientId,
      userId,
      referenceId: businessId,
      scopes: ["mcp:read"],
      createdAt: now,
      updatedAt: now,
    },
  });
}

/** An access token the way the OAuth plugin signs one, with the site's own keys. */
async function accessToken(claims: Record<string, unknown>) {
  const { token } = await auth.api.signJWT({
    body: {
      payload: { iss: ISSUER, aud: MCP_RESOURCE, scope: "mcp:read", ...claims },
    },
  });
  return token;
}

async function listTools(token: string) {
  const request = new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  const response = await hostMcpRoute.POST(request, { params: Promise.resolve({}) });
  if (response.status !== 200) return { status: response.status, tools: [] };
  const { result } = (await response.json()) as { result: { tools: Array<{ name: string }> } };
  return { status: response.status, tools: result.tools.map((tool) => tool.name) };
}

describe("connecting an AI app by signing in", () => {
  beforeEach(() => {
    resetMemoryRateLimits();
    // The token check fetches the site's public keys over HTTP; here they come straight from Better Auth.
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === JWKS_URL ? Response.json(await auth.api.getJwks()) : realFetch(input, init),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("tells AI apps where to sign in", async () => {
    const unauthorized = await hostMcpRoute.POST(
      new Request("http://localhost/api/mcp", { method: "POST", body: "{}" }),
      { params: Promise.resolve({}) },
    );
    expect(unauthorized.status).toBe(401);
    const metadataUrl = new URL("/.well-known/oauth-protected-resource/api/mcp", MCP_RESOURCE).toString();
    expect(unauthorized.headers.get("www-authenticate")).toContain(`resource_metadata="${metadataUrl}"`);

    const resource = (await (await protectedResource.GET()).json()) as Record<string, unknown>;
    expect(resource).toMatchObject({ resource: MCP_RESOURCE, scopes_supported: ["mcp:read"] });

    const server = await authServer.GET(
      new Request(`${env.BETTER_AUTH_URL}/.well-known/oauth-authorization-server`),
    );
    expect(await server.json()).toMatchObject({
      issuer: ISSUER,
      registration_endpoint: expect.stringContaining("/api/auth/oauth2/register"),
      code_challenge_methods_supported: ["S256"],
    });
  });

  it("offers only the places where the member may use AI apps, and keeps the pick on the sign-in session", async () => {
    const host = await signUp("Rana Khoury");
    const own = await createPlace(`Beit ${randomUUID().slice(0, 6)}`);
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { businessId: own.business.id, isOwner: true },
    });
    await prisma.membership.create({
      data: { userId: host.userId, businessId: own.business.id, roleId: ownerRole.id },
    });
    const other = await createPlace(`Dar ${randomUUID().slice(0, 6)}`);
    const readerRole = await prisma.role.create({
      data: { businessId: other.business.id, name: `reader-${randomUUID()}`, permissions: ["bookings.read"] },
    });
    await prisma.membership.create({
      data: { userId: host.userId, businessId: other.business.id, roleId: readerRole.id },
    });

    expect((await listConnectableWorkspaces(host.userId)).map((place) => place.id)).toEqual([
      own.business.id,
    ]);

    const session = await prisma.session.findFirstOrThrow({ where: { userId: host.userId } });
    await expect(
      chooseWorkspace({ id: session.id, userId: host.userId }, other.business.id),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await call(workspaceRoute.POST, { as: host, body: { businessId: own.business.id } })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect((await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).mcpBusinessId).toBe(
      own.business.id,
    );
    expect((await call(workspaceRoute.POST, { body: { businessId: own.business.id } })).status).toBe(401);
  });

  it("acts as the member in the place they allowed, read only, until they leave", async () => {
    const { business, ctx: owner } = await createPlace();
    const staff = await memberWith(business.id, ["bookings.read", "ai.use"]);
    const clientId = await registerApp();
    const claims = { sub: staff.userId, business_id: business.id, client_id: clientId };

    // Signed correctly, but never allowed: refused.
    expect((await listTools(await accessToken(claims))).status).toBe(401);

    await allow(staff.userId, clientId, business.id);
    expect(await listTools(await accessToken(claims))).toEqual({
      status: 200,
      tools: ["list_places", "list_bookings"],
    });
    // A token for another server, or without the read scope, is refused.
    expect((await listTools(await accessToken({ ...claims, aud: "https://elsewhere.example" }))).status).toBe(
      401,
    );
    expect((await listTools(await accessToken({ ...claims, scope: "openid" }))).status).toBe(401);
    // The place comes from the token: naming another business in it needs a consent there too.
    const stranger = await createPlace();
    expect(
      (await listTools(await accessToken({ ...claims, business_id: stranger.business.id }))).status,
    ).toBe(401);

    await removeMember(owner, staff.membershipId);
    expect((await listTools(await accessToken(claims))).status).toBe(401);
  });

  it("stops at once when the member disconnects the app, and only they can", async () => {
    const owner = await signUp("Nour Haddad");
    const { business } = await createPlace();
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { businessId: business.id, isOwner: true },
    });
    await prisma.membership.create({
      data: { userId: owner.userId, businessId: business.id, roleId: ownerRole.id },
    });
    const clientId = await registerApp("Claude");
    const consent = await allow(owner.userId, clientId, business.id);
    const token = await accessToken({ sub: owner.userId, business_id: business.id, client_id: clientId });
    expect((await listTools(token)).status).toBe(200);

    const other = await memberWith(business.id, ["ai.use"]);
    expect(await listConnectedApps(other)).toEqual([]);
    await expect(disconnectApp(other, consent.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const params = { businessId: business.id, connectionId: consent.id };
    expect(await call(connectedAppRoute.DELETE, { as: owner, method: "DELETE", params })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect((await listTools(token)).status).toBe(401);
    expect(
      await prisma.auditLog.count({ where: { entityId: consent.id, action: "ai_app.disconnected" } }),
    ).toBe(1);
    expect((await call(connectedAppRoute.DELETE, { as: owner, method: "DELETE", params })).status).toBe(404);
  });
});
