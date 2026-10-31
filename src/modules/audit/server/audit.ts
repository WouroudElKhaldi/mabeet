import type { TenantContext } from "@/server/auth/tenant-context";
import { type Db, prisma } from "@/server/db/client";
import { type ActivityEntry, logActivity } from "./activity-repository";
import { logAudit } from "./audit-repository";

/**
 * Records what a team member did in the business's audit log, which its notification bell reads. Pass the
 * change's transaction, so the change and its log line are saved together or not at all.
 */
export function recordAction(
  ctx: TenantContext,
  action: string,
  entity: string,
  entityId: string,
  db: Db = prisma,
) {
  return logAudit(db, { actorId: ctx.userId, businessId: ctx.businessId, action, entity, entityId });
}

/**
 * Something a person did that the business must also hear about (a guest's request, cancellation or review, or
 * someone joining the team): it goes on the person's own timeline and in the business's audit log.
 */
export async function recordPersonAndBusiness(db: Db, entry: ActivityEntry & { businessId: string }) {
  const { userId, ...event } = entry;
  await logActivity(db, entry);
  await logAudit(db, { ...event, actorId: userId });
}
