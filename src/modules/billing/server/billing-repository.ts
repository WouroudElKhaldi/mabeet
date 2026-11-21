import type { Plan, Prisma } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

// A host's plan (HostPlan, one per host, no row meaning Free), what all their places use against it, and processed
// webhooks. Every place a host hosts (Business.hostId) shares the one plan.

/** The host whose plan covers a place, and how the place is booked. Null for a place that doesn't exist. */
export function findPlaceHost(db: Db, businessId: string) {
  return db.business.findFirst({
    where: { id: businessId, isDeleted: false },
    select: { hostId: true, bookingUnit: true },
  });
}

/**
 * Holds the host's plan row until the transaction ends (making it first, as Free, if the host has none yet), so two
 * additions in any of their places at the same moment are counted one after the other and cannot both slip under the
 * plan's limit.
 */
export async function lockHostPlan(tx: Tx, hostId: string): Promise<void> {
  await tx.hostPlan.createMany({ data: [{ userId: hostId }], skipDuplicates: true });
  await tx.$queryRaw`SELECT "userId" FROM "HostPlan" WHERE "userId" = ${hostId} FOR UPDATE`;
}

const planFields = {
  plan: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  planRenewsAt: true,
} as const;

/** The host's plan, or Free with nothing to show when they never had one. */
export async function findHostPlan(db: Db, hostId: string) {
  const row = await db.hostPlan.findUnique({ where: { userId: hostId }, select: planFields });
  return (
    row ?? { plan: "FREE" as Plan, stripeCustomerId: null, stripeSubscriptionId: null, planRenewsAt: null }
  );
}

/**
 * What a host's places use against the plan, across all of them: rooms (a place booked whole counts as one room,
 * whatever rooms it describes), experiences and services, and team members (each person once, the host included).
 * Deleted places, rooms and offerings and removed members do not count.
 */
export async function countHostUsage(db: Db, hostId: string) {
  const [row] = await db.$queryRaw<Array<{ rooms: bigint; offerings: bigint; members: bigint }>>`
    SELECT
      (SELECT COALESCE(SUM(CASE WHEN b."bookingUnit" = 'WHOLE_PLACE' THEN 1 ELSE (
         SELECT COUNT(*) FROM "Room" r WHERE r."businessId" = b.id AND NOT r."isDeleted" AND r.kind = 'ROOM'
       ) END), 0)
       FROM "Business" b WHERE b."hostId" = ${hostId} AND NOT b."isDeleted")::bigint AS rooms,
      (SELECT COUNT(*) FROM "Offering" o JOIN "Business" b ON b.id = o."businessId"
       WHERE b."hostId" = ${hostId} AND NOT b."isDeleted" AND NOT o."isDeleted")::bigint AS offerings,
      (SELECT COUNT(DISTINCT m."userId") FROM "Membership" m JOIN "Business" b ON b.id = m."businessId"
       WHERE b."hostId" = ${hostId} AND NOT b."isDeleted" AND m.status = 'ACTIVE' AND NOT m."isDeleted")::bigint
       AS members`;
  return {
    rooms: Number(row?.rooms ?? 0),
    offerings: Number(row?.offerings ?? 0),
    members: Number(row?.members ?? 0),
  };
}

/** The rooms a place describes one by one (not its whole-place unit), deleted ones left out. */
export function countPlaceRooms(db: Db, businessId: string) {
  return db.room.count({ where: { businessId, kind: "ROOM", isDeleted: false } });
}

/** Whether a person already works in one of the host's places: adding them to another uses nothing more. */
export async function isOnHostTeam(db: Db, hostId: string, userId: string): Promise<boolean> {
  const found = await db.membership.findFirst({
    where: { userId, status: "ACTIVE", isDeleted: false, business: { hostId, isDeleted: false } },
    select: { id: true },
  });
  return found !== null;
}

/** The places a host hosts, for the billing page: the plan covers all of them. */
export function listHostedPlaces(db: Db, hostId: string) {
  return db.business.findMany({
    where: { hostId, isDeleted: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

/** When the host's first place joined, from which "first months" offers are counted. */
export async function findHostJoinedAt(db: Db, hostId: string): Promise<Date | null> {
  const first = await db.business.findFirst({
    where: { hostId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return first?.createdAt ?? null;
}

/** The plans of these hosts, for the admin's pages; a host with no row is on Free. */
export function findHostPlans(db: Db, hostIds: string[]) {
  return db.hostPlan.findMany({
    where: { userId: { in: hostIds } },
    select: { userId: true, ...planFields },
  });
}

export function findHostByCustomer(db: Db, stripeCustomerId: string) {
  return db.hostPlan.findUnique({
    where: { stripeCustomerId },
    select: { userId: true, stripeSubscriptionId: true },
  });
}

/** Writes a host's plan fields, making their row if they have none yet. */
export async function setHostPlan(
  db: Db,
  hostId: string,
  data: {
    plan?: Plan;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    planRenewsAt?: Date | null;
  },
) {
  await db.hostPlan.upsert({ where: { userId: hostId }, create: { userId: hostId, ...data }, update: data });
}

/**
 * Records a webhook event once. Run inside the transaction that applies it, so a failure rolls both back. False
 * when the event was already recorded: a retried or replayed event, even one arriving at the same moment.
 */
export async function recordWebhookEvent(
  tx: Tx,
  event: { provider: string; eventId: string; payload: Prisma.InputJsonValue },
): Promise<boolean> {
  const { count } = await tx.webhookEvent.createMany({ data: [event], skipDuplicates: true });
  return count === 1;
}
