import type { Prisma } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

// Experiences and services, and their dated sessions. Seats taken in a session are the booking engine's
// (SessionBooking): this module never reads them, so the seat count always comes from one place.

/** A live offering: not removed. Whether guests see it also needs `active`. */
const live = { isDeleted: false } as const;

/** What guests may book: switched on, not removed, at a business that is not paused or deleted. */
const bookable = {
  active: true,
  isDeleted: false,
  business: { status: "ACTIVE", isDeleted: false },
} as const satisfies Prisma.OfferingWhereInput;

export type OfferingData = Omit<Prisma.OfferingUncheckedCreateInput, "id" | "createdAt" | "updatedAt">;

export async function slugTaken(db: Db, slug: string): Promise<boolean> {
  return (await db.offering.count({ where: { slug } })) > 0;
}

export function createOffering(tx: Tx, offering: OfferingData) {
  return tx.offering.create({ data: offering });
}

export function findOffering(db: Db, businessId: string, offeringId: string) {
  return db.offering.findFirst({ where: { id: offeringId, businessId, ...live } });
}

/** An offering to schedule, with the time zone its sessions start in: the business's. */
export function findOfferingToSchedule(db: Db, businessId: string, offeringId: string) {
  return db.offering.findFirst({
    where: { id: offeringId, businessId, ...live },
    select: { id: true, title: true, durationMinutes: true, business: { select: { timezone: true } } },
  });
}

/** Changes the fields given. False when there is no such offering at this business. */
export async function updateOffering(
  tx: Tx,
  businessId: string,
  offeringId: string,
  data: Prisma.OfferingUncheckedUpdateManyInput,
): Promise<boolean> {
  const { count } = await tx.offering.updateMany({ where: { id: offeringId, businessId, ...live }, data });
  return count === 1;
}

/** The business's offerings for its team, newest first, with their photos and upcoming sessions. */
export function listOfferings(db: Db, businessId: string, now: Date) {
  return db.offering.findMany({
    where: { businessId, ...live },
    orderBy: { createdAt: "desc" },
    include: {
      photos: {
        where: { isDeleted: false },
        orderBy: { position: "asc" },
        select: { id: true, url: true, alt: true },
      },
      sessions: {
        where: { isDeleted: false, active: true, startsAt: { gt: now } },
        orderBy: { startsAt: "asc" },
        select: { id: true, startsAt: true, endsAt: true, capacity: true },
      },
    },
  });
}

// ---------- Sessions ----------

export function createSessions(
  tx: Tx,
  sessions: ReadonlyArray<{
    businessId: string;
    offeringId: string;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
  }>,
) {
  return tx.offeringSession.createManyAndReturn({
    data: [...sessions],
    select: { id: true, startsAt: true, endsAt: true, capacity: true },
  });
}

/**
 * Locks a live session of the business until the transaction ends and returns it. Every change to who sits in it
 * (a new booking, a decision, the session cancelled) waits here, so the seat count is read and written by one at a
 * time.
 */
export async function lockSession(tx: Tx, businessId: string, sessionId: string) {
  const rows = await tx.$queryRaw<
    Array<{ id: string; offeringId: string; startsAt: Date; capacity: number }>
  >`
    SELECT id, "offeringId", "startsAt", capacity FROM "OfferingSession"
    WHERE id = ${sessionId} AND "businessId" = ${businessId} AND NOT "isDeleted"
    FOR UPDATE`;
  return rows[0] ?? null;
}

/** Takes a session off the schedule. False when it was already gone. */
export async function closeSession(tx: Tx, businessId: string, sessionId: string): Promise<boolean> {
  const { count } = await tx.offeringSession.updateMany({
    where: { id: sessionId, businessId, isDeleted: false },
    data: { active: false, isDeleted: true },
  });
  return count === 1;
}

// ---------- What guests may book ----------

/** An offering guests can book, by its public link, with the business settings a new booking copies. */
export function findBookableOffering(db: Db, slug: string) {
  return db.offering.findFirst({
    where: { slug, ...bookable },
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      priceUnit: true,
      maxGuests: true,
      business: {
        select: { id: true, name: true, currency: true, bookingMode: true, holdHours: true, timezone: true },
      },
    },
  });
}

/** An open session of this offering: live, switched on and not started yet. */
export function findOpenSession(db: Db, offeringId: string, sessionId: string, now: Date) {
  return db.offeringSession.findFirst({
    where: { id: sessionId, offeringId, active: true, isDeleted: false, startsAt: { gt: now } },
    select: { id: true, businessId: true, startsAt: true, endsAt: true, capacity: true },
  });
}

// ---------- What guests see ----------

/** What a guest reads of an offering: never the business's plan, payment accounts or commission rate. */
const publicFields = {
  id: true,
  slug: true,
  kind: true,
  title: true,
  description: true,
  categorySlug: true,
  area: true,
  region: true,
  meetingPoint: true,
  latitude: true,
  longitude: true,
  durationMinutes: true,
  priceCents: true,
  priceUnit: true,
  maxGuests: true,
  minAge: true,
  activityLevel: true,
  skillLevel: true,
  included: true,
  notIncluded: true,
  accessibility: true,
  languages: true,
  tags: true,
  photos: {
    where: { isDeleted: false },
    orderBy: { position: "asc" },
    select: { id: true, url: true, alt: true },
  },
  business: {
    select: { name: true, slug: true, area: true, timezone: true, currency: true, bookingMode: true },
  },
} as const satisfies Prisma.OfferingSelect;

/** Sessions a guest can still pick: switched on, live and not started. */
const upcomingSessions = (now: Date) =>
  ({
    where: { isDeleted: false, active: true, startsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true, capacity: true },
  }) as const satisfies Prisma.Offering$sessionsArgs;

/** An offering guests can book, by its public link, with its upcoming sessions (the next `take`). */
export function findPublicOffering(db: Db, slug: string, now: Date, take: number) {
  return db.offering.findFirst({
    where: { slug, ...bookable },
    select: { ...publicFields, sessions: { ...upcomingSessions(now), take } },
  });
}

/**
 * The offerings of one kind on listed places, for browsing: those with a session coming first, then the newest, each
 * with its cover photo and next session.
 */
export function listPublicOfferings(
  db: Db,
  filter: { kind: "EXPERIENCE" | "SERVICE"; categorySlug?: string; take: number },
  now: Date,
) {
  return db.offering.findMany({
    where: {
      ...bookable,
      kind: filter.kind,
      business: { ...bookable.business, listedPublicly: true },
      ...(filter.categorySlug && { categorySlug: filter.categorySlug }),
    },
    orderBy: { createdAt: "desc" },
    take: filter.take,
    select: {
      id: true,
      slug: true,
      kind: true,
      title: true,
      categorySlug: true,
      area: true,
      durationMinutes: true,
      priceCents: true,
      priceUnit: true,
      photos: { ...publicFields.photos, take: 1 },
      business: { select: { currency: true, timezone: true } },
      sessions: { ...upcomingSessions(now), take: 1 },
    },
  });
}
