import type { Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

// One person's own timeline: what they did and what happened to them. Business and platform events, and the
// bells that show them, are in audit-repository.

export interface ActivityEntry {
  userId: string;
  /** The place it was about, when there is one. */
  businessId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}

export function logActivity(db: Db, entry: ActivityEntry) {
  return db.activityLog.create({ data: entry });
}
