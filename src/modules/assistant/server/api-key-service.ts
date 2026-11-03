import { createHash, randomBytes } from "node:crypto";
import { recordAction } from "@/modules/audit/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { resolveContext } from "@/server/auth/resolve-context";
import { inBackground } from "@/server/background";
import { prisma } from "@/server/db/client";
import { forbidden, notFound } from "@/server/errors";
import { addDays } from "@/utils/dates";
import * as keys from "./api-key-repository";
import type { ToolCallListener } from "./run-tool";

// Personal MCP keys: a member connects their own AI app (Claude, Cursor, Codex…) to one place. Whatever uses the key
// acts as that member, with their role there, and every key is read only in this first version.

const KEY_PREFIX = "mbt_";
/** How much of a key the list shows, so the person can tell their keys apart. */
const VISIBLE_PREFIX_LENGTH = 12;
const MAX_LOGGED_ERROR_LENGTH = 200;

const hashKey = (raw: string) => createHash("sha256").update(raw).digest("hex");

/**
 * Makes a key bound to the calling member. The plain key is returned this once; only its hash is stored, so it can
 * never be shown again.
 */
export async function createKey(
  ctx: TenantContext,
  input: { name: string; expiresInDays: number | null },
  now = new Date(),
) {
  requirePermission(ctx, "ai.use");
  // A key acts as a member of the team; a platform admin visiting a business is not one.
  if (ctx.platformAdmin)
    throw forbidden("Platform admins can't create AI keys for a business they don't belong to");
  const raw = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const key = await keys.createApiKey(prisma, {
    businessId: ctx.businessId,
    membershipId: ctx.membershipId,
    createdById: ctx.userId,
    name: input.name,
    prefix: raw.slice(0, VISIBLE_PREFIX_LENGTH),
    hash: hashKey(raw),
    expiresAt: input.expiresInDays ? addDays(now, input.expiresInDays) : null,
  });
  await recordAction(ctx, "api_key.created", "api_key", key.id);
  return { ...key, secret: raw };
}

/** The member's own keys in this place. Nobody sees another member's keys. */
export function listKeys(ctx: TenantContext) {
  requirePermission(ctx, "ai.use");
  return keys.listMemberKeys(prisma, ctx.businessId, ctx.membershipId);
}

/** Stops one of the member's keys at once. */
export async function revokeKey(ctx: TenantContext, keyId: string, now = new Date()) {
  requirePermission(ctx, "ai.use");
  if (!(await keys.revokeMemberKey(prisma, ctx.businessId, ctx.membershipId, keyId, now)))
    throw notFound("Key");
  await recordAction(ctx, "api_key.revoked", "api_key", keyId);
}

/**
 * The member a presented key acts as, or null. The key works only while its member is still on the team with the
 * same membership: a member who was removed (even if invited back since) loses their old keys at once.
 */
export async function authenticateKey(raw: string, now = new Date()) {
  if (!raw.startsWith(KEY_PREFIX)) return null;
  const key = await keys.findLiveKeyByHash(prisma, hashKey(raw), now);
  if (!key) return null;
  const ctx = await resolveContext(key.createdById, key.businessId, "mcp");
  if (!ctx || ctx.membershipId !== key.membershipId) return null;
  inBackground("MCP key last used", () => keys.touchKey(prisma, key.id, now));
  return { ctx: { ...ctx, readOnly: !key.canWrite }, keyId: key.id };
}

/** Writes each AI tool call to the place's log after the answer, so logging never slows an AI app down. */
export function toolCallRecorder(caller: {
  businessId: string;
  userId: string;
  channel: "mcp" | "chat";
  apiKeyId?: string;
}): ToolCallListener {
  return (tool, outcome, latencyMs) =>
    inBackground("AI tool call log", () =>
      keys.logToolCall(prisma, {
        ...caller,
        tool,
        outcome: outcome.ok ? "ok" : outcome.error.slice(0, MAX_LOGGED_ERROR_LENGTH),
        latencyMs,
      }),
    );
}

/** What AI apps asked in this place, newest first, for the keys page. */
export function listToolCalls(ctx: TenantContext, take = 20) {
  requirePermission(ctx, "ai.use");
  return keys.listToolCalls(prisma, ctx.businessId, take);
}
