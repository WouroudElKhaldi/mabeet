import type { Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

// What happens in a business or on the platform, and who did it. The business and admin notification bells and
// the admin audit trail read from here; a person's own timeline is in activity-repository.

export interface AuditEntry {
  /** Who did it; empty for the system's own events (a payment landing, a calendar clash). */
  actorId: string | null;
  businessId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}

export function logAudit(db: Db, entry: AuditEntry) {
  return db.auditLog.create({ data: entry });
}
