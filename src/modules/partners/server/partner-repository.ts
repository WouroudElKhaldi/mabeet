import type { Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

// Featured partners (F23): places near guesthouses that are not on the platform, and the dates they are sponsored.
// They belong to no business, so these queries filter by region or id, never by a business.

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
