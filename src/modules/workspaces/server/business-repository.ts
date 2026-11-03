import type { Prisma } from "@prisma/client";
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
  description: true,
  area: true,
  region: true,
  address: true,
  phone: true,
  whatsapp: true,
  currency: true,
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
export function findListedBusinesses(db: Db, filters: PlaceFilters, take: number) {
  return db.business.findMany({
    where: {
      listedPublicly: true,
      status: "ACTIVE",
      isDeleted: false,
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
    select: {
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
    },
    orderBy: { createdAt: "asc" },
    take,
  });
}
