import type { PlatformActor, TenantContext } from "@/server/auth/tenant-context";
import type { FeedNote } from "./audit-repository";
import { type Db, prisma } from "@/server/db/client";
import { type ActivityEntry, logActivity, readActivity } from "./activity-repository";
import { countFeedRows, countFeedRowsSince, type FeedScope, logAudit, readFeed } from "./audit-repository";

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
  note?: FeedNote,
) {
  return logAudit(db, {
    actorId: ctx.userId,
    businessId: ctx.businessId,
    action,
    entity,
    entityId,
    meta: note,
  });
}

/**
 * Something a person did that the business must also hear about (a guest's request, cancellation or review, or
 * someone joining the team): it goes on the person's own timeline and in the business's audit log.
 */
export async function recordPersonAndBusiness(
  db: Db,
  entry: ActivityEntry & { businessId: string; note?: FeedNote },
) {
  const { userId, note, ...event } = entry;
  await logActivity(db, { userId, ...event });
  await logAudit(db, { ...event, actorId: userId, meta: note });
}

/**
 * Something the system did in a business, with nobody behind it (a hold that ran out, a platform booking clashing
 * with our nights): it goes in the business's audit log, so the bell shows it.
 */
export function recordSystemEvent(
  db: Db,
  entry: { businessId: string; action: string; entity: string; entityId: string; note?: FeedNote },
) {
  const { note, ...event } = entry;
  return logAudit(db, { ...event, actorId: null, meta: note });
}

/**
 * Something a platform admin did from the admin area (a payout sent, a business suspended), under their own name.
 * With a `businessId` it also reaches that business's audit log.
 */
export function recordPlatformAction(
  actor: PlatformActor,
  entry: { businessId: string | null; action: string; entity: string; entityId: string },
  db: Db = prisma,
) {
  return logAudit(db, { ...entry, actorId: actor.userId });
}

/** Something that happened to a person (their booking was confirmed, declined or ran out): their own timeline. */
export function notePerson(db: Db, entry: ActivityEntry) {
  return logActivity(db, entry);
}

/** One page of the notable events of a business, or of the whole platform, newest first. */
export function listFeed(scope: FeedScope, actions: readonly string[], page: { take: number; skip: number }) {
  return readFeed(prisma, scope, actions, page);
}

export function countFeed(scope: FeedScope, actions: readonly string[]) {
  return countFeedRows(prisma, scope, actions);
}

/** How many notable events arrived since a moment, not counting the person's own. */
export function countFeedSince(
  scope: FeedScope,
  actions: readonly string[],
  since: Date | null,
  excludeUserId: string,
) {
  return countFeedRowsSince(prisma, scope, actions, since, excludeUserId);
}

/** The newest entries of one person's own timeline, for their account's Activity page. */
export function listPersonActivity(userId: string, take: number) {
  return readActivity(prisma, userId, take);
}
