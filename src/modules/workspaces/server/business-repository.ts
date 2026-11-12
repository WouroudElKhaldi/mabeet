import type { BusinessStatus, Prisma } from "@prisma/client";
import { areasMatching, regionNamed } from "@/config/regions";
import type { Db, Tx } from "@/server/db/client";

export function slugExists(db: Db, slug: string) {
  return db.business.count({ where: { slug } }).then((count) => count > 0);
}

export interface NewBusinessWithOwner {
  business: Omit<Prisma.BusinessCreateInput, "roles" | "memberships">;
  ownerUserId: string;
  starterRoles: ReadonlyArray<{ name: string; description: string; permissions: string[] }>;
}

export async function createBusinessWithOwner(tx: Tx, input: NewBusinessWithOwner) {
  const business = await tx.business.create({
    data: {
      ...input.business,
      roles: { create: input.starterRoles.map((role) => ({ ...role })) },
    },
  });
  await tx.role.create({
    data: {
      businessId: business.id,
      name: "Owner",
      description: "Full access",
      permissions: [],
      isOwner: true,
      memberships: { create: { userId: input.ownerUserId, businessId: business.id } },
    },
  });
  return business;
}

/**
 * A live place's public page, by its link. Only what any visitor may see: never its plan, payment accounts,
 * commission rate or payment instructions (those go to a guest on their own booking). The phone and WhatsApp are
 * the business's own, the only numbers guests are given.
 */
export function findPublicBusinessBySlug(db: Db, slug: string) {
  return db.business.findFirst({
    where: { slug, status: "ACTIVE", isDeleted: false },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      area: true,
      region: true,
      address: true,
      latitude: true,
      longitude: true,
      phone: true,
      whatsapp: true,
      timezone: true,
      currency: true,
      holdHours: true,
      checkInTime: true,
      checkOutTime: true,
      houseRules: true,
      bookingUnit: true,
      bookingMode: true,
      tags: true,
      accessibility: true,
      minGuestAge: true,
    },
  });
}

/** The settings the dashboard edits, with when the owner accepted full refunds for online payments. */
const settingsFields = {
  name: true,
  slug: true,
  description: true,
  area: true,
  region: true,
  address: true,
  phone: true,
  whatsapp: true,
  currency: true,
  timezone: true,
  status: true,
  lbpRate: true,
  commissionRateBps: true,
  holdHours: true,
  paymentInstructions: true,
  checkInTime: true,
  checkOutTime: true,
  houseRules: true,
  bookingUnit: true,
  bookingMode: true,
  onlineTermsAcceptedAt: true,
  listedPublicly: true,
  tags: true,
  accessibility: true,
  minGuestAge: true,
  latitude: true,
  longitude: true,
  categories: {
    where: { isDeleted: false },
    select: { categorySlug: true },
    orderBy: { categorySlug: "asc" },
  },
} satisfies Prisma.BusinessSelect;

export function findBusinessSettings(db: Db, businessId: string) {
  return db.business.findFirst({ where: { id: businessId, isDeleted: false }, select: settingsFields });
}

export function updateBusinessSettings(tx: Tx, businessId: string, data: Prisma.BusinessUpdateInput) {
  return tx.business.update({ where: { id: businessId }, data, select: settingsFields });
}

/**
 * Makes the place's categories exactly `slugs`: the others are marked deleted, and a category picked again is
 * brought back rather than added twice (the business and the slug are the row's key).
 */
export async function setBusinessCategories(tx: Tx, businessId: string, slugs: readonly string[]) {
  await tx.businessCategory.updateMany({
    where: { businessId, categorySlug: { notIn: [...slugs] }, isDeleted: false },
    data: { isDeleted: true },
  });
  for (const categorySlug of slugs) {
    await tx.businessCategory.upsert({
      where: { businessId_categorySlug: { businessId, categorySlug } },
      create: { businessId, categorySlug },
      update: { isDeleted: false },
    });
  }
}

/** A place guests can book: live, not deleted, found by its public link. */
export function findBookableBusinessBySlug(db: Db, slug: string) {
  return db.business.findFirst({
    where: { slug, status: "ACTIVE", isDeleted: false },
    select: {
      id: true,
      name: true,
      currency: true,
      bookingMode: true,
      bookingUnit: true,
      holdHours: true,
    },
  });
}

/** For calendar sync: the place's name and time zone, and how it is booked. */
export function findPlaceForCalendar(db: Db, businessId: string) {
  return db.business.findFirst({
    where: { id: businessId, isDeleted: false },
    select: { id: true, name: true, timezone: true, bookingUnit: true },
  });
}

/** For analytics: what the reports need of each place, live ones only. */
export function findPlacesForReports(db: Db, businessIds: readonly string[]) {
  return db.business.findMany({
    where: { id: { in: [...businessIds] }, isDeleted: false },
    select: { id: true, name: true, slug: true, currency: true, commissionRateBps: true, bookingUnit: true },
  });
}

/** What a guest can ask of a place itself in search; what they ask of its rooms is the rooms module's. */
export interface PlaceFilters {
  /** A town, or a region ("North Lebanon", "الشمال"). */
  area?: string;
  /** Words in the place's name, description or town. */
  text?: string;
  /** The place is in at least one of these categories. */
  categories?: readonly string[];
  /** The place has at least one of these tags. */
  tags?: readonly string[];
  /** The place has every one of these accessibility features. */
  accessibility?: readonly string[];
  /** Only these places (the featured ones, read on their own so they are never left out of a page). */
  ids?: readonly string[];
}

/**
 * Where a place is, from what a guest typed: a region matches the region the place stores, or any of its towns for a
 * place whose region is not known; anything else is matched as a town.
 */
function inArea(text: string): Prisma.BusinessWhereInput {
  const region = regionNamed(text);
  const towns = areasMatching(text).map((town) => ({
    area: { contains: town, mode: "insensitive" as const },
  }));
  return { OR: region ? [{ region }, ...towns] : towns };
}

/**
 * Places in search: live, listed by their owner, and matching every filter, oldest first. Only what a result card
 * shows, never the owner's settings.
 */
/** What a place shows as a card: in search, and in a guest's saved places. */
const LISTED_BUSINESS_FIELDS = {
  id: true,
  slug: true,
  name: true,
  area: true,
  currency: true,
  bookingUnit: true,
  categories: {
    where: { isDeleted: false },
    select: { categorySlug: true },
    orderBy: { categorySlug: "asc" },
  },
} satisfies Prisma.BusinessSelect;

/**
 * The same fields as a search result, for places named by id: a guest's saved places. A place its owner has
 * unlisted is still here (its page still works, and the guest chose it), but a paused or deleted one is not.
 */
/** The names of businesses by id, whatever their status: for the admin, who sees paused and deleted places too. */
export function findBusinessNames(db: Db, businessIds: readonly string[]) {
  if (businessIds.length === 0) return Promise.resolve([]);
  return db.business.findMany({
    where: { id: { in: [...businessIds] } },
    select: { id: true, name: true },
  });
}

export function findBusinessesByIds(db: Db, businessIds: readonly string[]) {
  if (businessIds.length === 0) return Promise.resolve([]);
  return db.business.findMany({
    where: { id: { in: [...businessIds] }, status: "ACTIVE", isDeleted: false },
    select: LISTED_BUSINESS_FIELDS,
  });
}

export function findListedBusinesses(db: Db, filters: PlaceFilters, take: number) {
  return db.business.findMany({
    where: {
      listedPublicly: true,
      status: "ACTIVE",
      isDeleted: false,
      id: filters.ids ? { in: [...filters.ids] } : undefined,
      tags: filters.tags?.length ? { hasSome: [...filters.tags] } : undefined,
      accessibility: filters.accessibility?.length ? { hasEvery: [...filters.accessibility] } : undefined,
      categories: filters.categories?.length
        ? { some: { categorySlug: { in: [...filters.categories] }, isDeleted: false } }
        : undefined,
      AND: [
        filters.area ? inArea(filters.area) : {},
        filters.text
          ? {
              OR: [
                { name: { contains: filters.text, mode: "insensitive" } },
                { description: { contains: filters.text, mode: "insensitive" } },
                { area: { contains: filters.text, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    select: LISTED_BUSINESS_FIELDS,
    orderBy: { createdAt: "asc" },
    take,
  });
}

/**
 * Every business on the platform for the admin, the newest first: its status, its owners and how big it is. Deleted
 * businesses stay out; a suspended one stays in, so it can be brought back.
 */
export function listPlatformBusinesses(db: Db, take: number) {
  return db.business.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      slug: true,
      area: true,
      status: true,
      plan: true,
      createdAt: true,
      memberships: {
        where: {
          status: "ACTIVE",
          isDeleted: false,
          role: { isOwner: true, isDeleted: false },
          user: { isDeleted: false },
        },
        select: { user: { select: { id: true, name: true, email: true, phone: true } } },
      },
      _count: { select: { rooms: { where: { isDeleted: false } }, bookings: true } },
    },
  });
}

export function countPlatformBusinesses(db: Db) {
  return db.business.count({ where: { isDeleted: false } });
}

/**
 * Moves the place from one status to another, only if it is still in the first: an owner archiving a place the
 * admin suspended a moment earlier changes nothing. False when it was not in `from`.
 */
export async function changeBusinessStatus(
  tx: Tx,
  businessId: string,
  from: BusinessStatus,
  to: BusinessStatus,
) {
  const { count } = await tx.business.updateMany({
    where: { id: businessId, status: from, isDeleted: false },
    data: { status: to },
  });
  return count === 1;
}

/** Suspends or reactivates a business. False when there is no such business. */
export async function setBusinessStatus(db: Db, businessId: string, status: BusinessStatus) {
  const { count } = await db.business.updateMany({
    where: { id: businessId, isDeleted: false },
    data: { status },
  });
  return count > 0;
}
