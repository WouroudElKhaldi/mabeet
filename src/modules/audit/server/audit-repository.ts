import type { Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

// What happens in a business or on the platform, and who did it. The business and admin notification bells and
// the admin audit trail read from here; a person's own timeline is in activity-repository.

/**
 * What the bell shows about the booking an event is about, written by the booking engine with the event: the bell
 * never reads the bookings themselves, which belong to another module.
 */
export interface FeedNote {
  guest: string;
  reference: string;
}

export interface AuditEntry {
  /** Who did it; empty for the system's own events (a payment landing, a calendar clash). */
  actorId: string | null;
  businessId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue | FeedNote;
}

export function logAudit(db: Db, entry: AuditEntry) {
  return db.auditLog.create({ data: entry });
}

/** A business's events, or every business's (the admin's bell). */
export type FeedScope = { businessId: string } | { platform: true };

function scopeWhere(scope: FeedScope): Prisma.AuditLogWhereInput {
  return "businessId" in scope ? { businessId: scope.businessId, isDeleted: false } : { isDeleted: false };
}

function asNote(meta: Prisma.JsonValue): FeedNote | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const { guest, reference } = meta;
  return typeof guest === "string" && typeof reference === "string" ? { guest, reference } : null;
}

export async function readFeed(
  db: Db,
  scope: FeedScope,
  actions: readonly string[],
  page: { take: number; skip: number },
) {
  const rows = await db.auditLog.findMany({
    where: { ...scopeWhere(scope), action: { in: [...actions] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: page.take,
    skip: page.skip,
    select: {
      id: true,
      action: true,
      actorId: true,
      createdAt: true,
      meta: true,
      actor: { select: { name: true } },
      business: { select: { id: true, name: true } },
    },
  });
  return rows.map(({ meta, ...row }) => ({ ...row, booking: asNote(meta) }));
}

export function countFeedRows(db: Db, scope: FeedScope, actions: readonly string[]) {
  return db.auditLog.count({ where: { ...scopeWhere(scope), action: { in: [...actions] } } });
}

export function countFeedRowsSince(
  db: Db,
  scope: FeedScope,
  actions: readonly string[],
  since: Date | null,
  excludeUserId: string,
) {
  return db.auditLog.count({
    where: {
      ...scopeWhere(scope),
      action: { in: [...actions] },
      createdAt: since ? { gt: since } : undefined,
      OR: [{ actorId: null }, { actorId: { not: excludeUserId } }],
    },
  });
}
