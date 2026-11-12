import type { PartnerKind, Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

// Featured partners (F23): places near guesthouses that are not on the platform, and the dates they are sponsored;
// and the dates guesthouses on the platform are featured. Partners belong to no business, so their queries filter
// by region or id; a featured guesthouse's sponsorship is found by its business.

const PARTNER = {
  id: true,
  name: true,
  kind: true,
  region: true,
  area: true,
  latitude: true,
  longitude: true,
  photoUrl: true,
  websiteUrl: true,
  phone: true,
} as const;

/** A sponsorship that covers `today` (its last day is `endsOn - 1`). */
const sponsoredOn = (today: Date): Prisma.SponsorshipWhereInput => ({
  isDeleted: false,
  startsOn: { lte: today },
  endsOn: { gt: today },
});

/** Every partner for the admin, removed ones included, with the sponsorships not over yet. */
export function listPartners(db: Db, today: Date) {
  return db.partnerPlace.findMany({
    orderBy: [{ isDeleted: "asc" }, { region: "asc" }, { name: "asc" }],
    select: {
      ...PARTNER,
      isDeleted: true,
      sponsorships: {
        where: { isDeleted: false, endsOn: { gt: today } },
        orderBy: { startsOn: "asc" },
        select: { id: true, startsOn: true, endsOn: true },
      },
    },
  });
}

export interface PartnerFilters {
  /** Words in the name or the area. */
  q: string;
  kind?: PartnerKind;
  region?: string;
  /** The removed partners instead of the live ones. */
  removed: boolean;
}

function partnerWhere({ q, kind, region, removed }: PartnerFilters): Prisma.PartnerPlaceWhereInput {
  const words = { contains: q, mode: "insensitive" } as const;
  return {
    isDeleted: removed,
    ...(kind ? { kind } : {}),
    ...(region ? { region } : {}),
    ...(q ? { OR: [{ name: words }, { area: words }] } : {}),
  };
}

/** One page of the partners for the admin's table, by region then name, with the sponsorships not over yet. */
export function listPartnerPage(
  db: Db,
  filters: PartnerFilters,
  today: Date,
  page: { skip: number; take: number },
) {
  return db.partnerPlace.findMany({
    where: partnerWhere(filters),
    orderBy: [{ region: "asc" }, { name: "asc" }, { id: "asc" }],
    ...page,
    select: {
      ...PARTNER,
      isDeleted: true,
      sponsorships: {
        where: { isDeleted: false, endsOn: { gt: today } },
        orderBy: { startsOn: "asc" },
        select: { id: true, startsOn: true, endsOn: true },
      },
    },
  });
}

export function countPartners(db: Db, filters: PartnerFilters) {
  return db.partnerPlace.count({ where: partnerWhere(filters) });
}

export async function createPartner(db: Db, data: Prisma.PartnerPlaceCreateInput) {
  const { id } = await db.partnerPlace.create({ data, select: { id: true } });
  return id;
}

/** False when there is no such live partner. */
export async function updatePartner(db: Db, partnerId: string, data: Prisma.PartnerPlaceUpdateInput) {
  const { count } = await db.partnerPlace.updateMany({ where: { id: partnerId, isDeleted: false }, data });
  return count > 0;
}

/** Removes a live partner, or brings back a removed one. False when it was not in the other state. */
export async function setPartnerRemoved(db: Db, partnerId: string, removed: boolean) {
  const { count } = await db.partnerPlace.updateMany({
    where: { id: partnerId, isDeleted: !removed },
    data: { isDeleted: removed },
  });
  return count > 0;
}

export function findLivePartner(db: Db, partnerId: string) {
  return db.partnerPlace.findFirst({ where: { id: partnerId, isDeleted: false }, select: { id: true } });
}

export async function createSponsorship(db: Db, data: Prisma.SponsorshipUncheckedCreateInput) {
  const { id } = await db.sponsorship.create({ data, select: { id: true } });
  return id;
}

/** Ends one of a partner's sponsorships. False when it is not theirs or already gone. */
export async function removeSponsorship(db: Db, partnerId: string, sponsorshipId: string) {
  const { count } = await db.sponsorship.updateMany({
    where: { id: sponsorshipId, partnerPlaceId: partnerId, isDeleted: false },
    data: { isDeleted: true },
  });
  return count > 0;
}

/** The live partners of a region, each with whether a sponsorship covers `today`. */
export async function listPartnersInRegion(db: Db, region: string, today: Date) {
  const partners = await db.partnerPlace.findMany({
    where: { region, isDeleted: false },
    select: { ...PARTNER, sponsorships: { where: sponsoredOn(today), select: { id: true }, take: 1 } },
  });
  return partners.map(({ sponsorships, ...partner }) => ({ ...partner, sponsored: sponsorships.length > 0 }));
}

/** The days guesthouses are featured that are not over yet, soonest first. */
export function listPlaceSponsorships(db: Db, today: Date) {
  return db.sponsorship.findMany({
    where: { businessId: { not: null }, isDeleted: false, endsOn: { gt: today } },
    orderBy: { startsOn: "asc" },
    select: { id: true, businessId: true, startsOn: true, endsOn: true },
  });
}

/** Ends a guesthouse's featured days. False when there is no such live one. */
export async function removePlaceSponsorship(db: Db, sponsorshipId: string) {
  const { count } = await db.sponsorship.updateMany({
    where: { id: sponsorshipId, businessId: { not: null }, isDeleted: false },
    data: { isDeleted: true },
  });
  return count > 0;
}

/** The guesthouses featured on `today`. */
export async function findFeaturedBusinessIds(db: Db, today: Date): Promise<string[]> {
  const rows = await db.sponsorship.findMany({
    where: { ...sponsoredOn(today), businessId: { not: null } },
    select: { businessId: true },
    distinct: ["businessId"],
  });
  return rows.flatMap((row) => (row.businessId ? [row.businessId] : []));
}

/** The experiences and services sponsored on `today`. */
export async function findSponsoredOfferingIds(db: Db, today: Date): Promise<string[]> {
  const rows = await db.sponsorship.findMany({
    where: { ...sponsoredOn(today), offeringId: { not: null } },
    select: { offeringId: true },
    distinct: ["offeringId"],
  });
  return rows.flatMap((row) => (row.offeringId ? [row.offeringId] : []));
}
