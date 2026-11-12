import type { AiCallChannel } from "@/config/enums";
import type { Db } from "@/server/db/client";

// MCP keys and the log of every AI tool call. A key is never shown again after it is made: only its hash is kept.

export function createApiKey(
  db: Db,
  key: {
    businessId: string;
    membershipId: string;
    createdById: string;
    name: string;
    prefix: string;
    hash: string;
    expiresAt: Date | null;
    canWrite: boolean;
  },
) {
  return db.apiKey.create({
    data: key,
    select: { id: true, name: true, prefix: true, canWrite: true, expiresAt: true, createdAt: true },
  });
}

/** The member's own keys that still work or ran out, newest first. Revoked ones are gone from the list. */
export function listMemberKeys(db: Db, businessId: string, membershipId: string) {
  return db.apiKey.findMany({
    where: { businessId, membershipId, revokedAt: null, isDeleted: false },
    select: {
      id: true,
      name: true,
      prefix: true,
      canWrite: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Revokes one of the member's own keys. False when it is not theirs, or already revoked. */
export async function revokeMemberKey(
  db: Db,
  businessId: string,
  membershipId: string,
  keyId: string,
  now: Date,
) {
  const { count } = await db.apiKey.updateMany({
    where: { id: keyId, businessId, membershipId, revokedAt: null, isDeleted: false },
    data: { revokedAt: now },
  });
  return count > 0;
}

/** A key that still works: not revoked, not deleted, not past its end. */
export function findLiveKeyByHash(db: Db, hash: string, now: Date) {
  return db.apiKey.findFirst({
    where: { hash, revokedAt: null, isDeleted: false, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { id: true, businessId: true, membershipId: true, createdById: true, canWrite: true },
  });
}

export function touchKey(db: Db, keyId: string, now: Date) {
  return db.apiKey.update({ where: { id: keyId }, data: { lastUsedAt: now } });
}

export function logToolCall(
  db: Db,
  entry: {
    businessId?: string;
    apiKeyId?: string;
    userId?: string;
    channel: AiCallChannel;
    tool: string;
    outcome: string;
    latencyMs: number;
  },
) {
  return db.mcpAuditLog.create({ data: entry });
}

export function listToolCalls(db: Db, businessId: string, take: number) {
  return db.mcpAuditLog.findMany({
    where: { businessId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, tool: true, channel: true, outcome: true, latencyMs: true, createdAt: true },
  });
}

/** Every AI tool call since a moment, across the platform, counted by tool and channel, with how long they took. */
export function countToolCalls(db: Db, since: Date) {
  return db.mcpAuditLog.groupBy({
    by: ["tool", "channel"],
    where: { createdAt: { gte: since }, isDeleted: false },
    _count: { _all: true },
    _avg: { latencyMs: true },
  });
}

/** The calls since a moment that did not work, counted the same way. */
export function countFailedToolCalls(db: Db, since: Date) {
  return db.mcpAuditLog.groupBy({
    by: ["tool", "channel"],
    where: { createdAt: { gte: since }, isDeleted: false, outcome: { not: "ok" } },
    _count: { _all: true },
  });
}
