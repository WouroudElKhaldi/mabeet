import { recordAction } from "@/modules/audit/server";
import { listWorkspaces } from "@/modules/team/server";
import { mayConnectAi } from "@/server/auth/mcp-oauth";
import { resolveContext } from "@/server/auth/resolve-context";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { forbidden, notFound } from "@/server/errors";
import * as oauth from "./oauth-repository";

// Connecting an AI app by signing in instead of with a key. The person signs in, picks one place and allows the app
// to read. Its tokens then act as that member, in that place, read only like every key, until they disconnect it.

/** The places this person may connect an AI app to: they are allowed to use AI apps there. */
export async function listConnectableWorkspaces(userId: string) {
  const workspaces = await listWorkspaces(userId);
  const allowed = await Promise.all(
    workspaces.map((workspace) => mayConnectAi(userId, workspace.business.id)),
  );
  return workspaces
    .filter((_, index) => allowed[index])
    .map((workspace) => ({
      id: workspace.business.id,
      name: workspace.business.name,
      role: workspace.role.name,
    }));
}

/** Keeps the picked place on the sign-in session, for the rest of this authorization. */
export async function chooseWorkspace(session: { id: string; userId: string }, businessId: string) {
  if (!(await mayConnectAi(session.userId, businessId)))
    throw forbidden("You can't connect an AI app to this place");
  await oauth.setSessionWorkspace(prisma, session.id, businessId);
}

/**
 * The member a verified access token acts as. Null when they left the place, may no longer use AI apps there, or
 * disconnected the app: tokens are signed rather than stored, so the consent is checked on every call.
 */
export async function contextForToken(userId: string, businessId: string, clientId: string) {
  const [allowed, consented] = await Promise.all([
    mayConnectAi(userId, businessId),
    oauth.hasConsent(prisma, userId, clientId, businessId),
  ]);
  if (!allowed || !consented) return null;
  const ctx = await resolveContext(userId, businessId, "mcp");
  return ctx && { ...ctx, readOnly: true };
}

/** Names for the consent page: the app asking, and the place it would work in. */
export async function describeConsent(userId: string, businessId: unknown, clientId: string) {
  const [appName, workspaces] = await Promise.all([
    oauth.findClientName(prisma, clientId),
    listConnectableWorkspaces(userId),
  ]);
  return { appName, businessName: workspaces.find((workspace) => workspace.id === businessId)?.name ?? null };
}

/** The AI apps this member connected to this place by signing in. Nobody sees another member's apps. */
export async function listConnectedApps(ctx: TenantContext) {
  requirePermission(ctx, "ai.use");
  const consents = await oauth.listConsents(prisma, ctx.userId, ctx.businessId);
  return consents.map((consent) => ({
    id: consent.id,
    name: consent.client.name,
    connectedAt: consent.createdAt,
  }));
}

/** Disconnects one of the member's apps from this place at once: its next call is refused. */
export async function disconnectApp(ctx: TenantContext, connectionId: string) {
  requirePermission(ctx, "ai.use");
  await runInTransaction(async (tx) => {
    if (!(await oauth.deleteConsent(tx, ctx.userId, ctx.businessId, connectionId)))
      throw notFound("Connected app");
    await recordAction(ctx, "ai_app.disconnected", "oauth_consent", connectionId, tx);
  });
}
