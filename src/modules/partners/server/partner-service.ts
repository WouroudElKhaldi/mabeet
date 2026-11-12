import type { z } from "zod";
import { recordPlatformAction } from "@/modules/audit/server";
import { listPlacesByIds } from "@/modules/workspaces/server";
import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { type Db, prisma, runInTransaction } from "@/server/db/client";
import { invalid, notFound } from "@/server/errors";
import { parseIsoDate, todayUtc, toIsoDate } from "@/utils/dates";
import { distanceKm, mapPin } from "@/utils/geo";
import { pageOf } from "@/utils/paging";
import type { featureInput, partnerInput, sponsorshipInput } from "../schemas";
import * as partners from "./partner-repository";

// Featured partners and sponsored listings (F23). Only platform admins add, change, remove and sponsor partners, and
// every change is logged under their name. Guests read the partners of the region they stay in, sponsored ones first
// and always marked so: a sponsored partner is never a hidden ad.

/** How many partners a place's page shows near the stay. */
const NEARBY_LIMIT = 12;

function logPartner(actor: PlatformActor, action: string, partnerId: string, db: Db) {
  return recordPlatformAction(
    actor,
    { businessId: null, action, entity: "partner", entityId: partnerId },
    db,
  );
}

/** Every partner, removed ones last, with the sponsorships not over yet (dates as ISO days, `endsOn` exclusive). */
export async function listPartnersForAdmin(actor: PlatformActor, now = new Date()) {
  requirePlatformAdmin(actor);
  const rows = await partners.listPartners(prisma, todayUtc(now));
  return rows.map(({ sponsorships, ...partner }) => ({
    ...partner,
    sponsorships: sponsorships.map((sponsorship) => ({
      id: sponsorship.id,
      startsOn: toIsoDate(sponsorship.startsOn),
      endsOn: toIsoDate(sponsorship.endsOn),
    })),
  }));
}

/** One page of the partners for the admin's table, searched and filtered, with the sponsorships not over yet. */
export async function listPartnerPage(
  actor: PlatformActor,
  filters: partners.PartnerFilters,
  page = 1,
  now = new Date(),
) {
  requirePlatformAdmin(actor);
  const total = await partners.countPartners(prisma, filters);
  const { skip, take, ...paging } = pageOf(total, page);
  const rows = await partners.listPartnerPage(prisma, filters, todayUtc(now), { skip, take });
  return {
    total,
    ...paging,
    partners: rows.map(({ sponsorships, ...partner }) => ({
      ...partner,
      sponsorships: sponsorships.map((sponsorship) => ({
        id: sponsorship.id,
        startsOn: toIsoDate(sponsorship.startsOn),
        endsOn: toIsoDate(sponsorship.endsOn),
      })),
    })),
  };
}

export async function createPartner(actor: PlatformActor, input: z.infer<typeof partnerInput>) {
  requirePlatformAdmin(actor);
  return runInTransaction(async (tx) => {
    const id = await partners.createPartner(tx, input);
    await logPartner(actor, "partner.created", id, tx);
    return { id };
  });
}

export async function updatePartner(
  actor: PlatformActor,
  partnerId: string,
  input: z.infer<typeof partnerInput>,
) {
  requirePlatformAdmin(actor);
  await runInTransaction(async (tx) => {
    if (!(await partners.updatePartner(tx, partnerId, input))) throw notFound("Partner");
    await logPartner(actor, "partner.updated", partnerId, tx);
  });
}

/** Takes a partner off every page. Its sponsorships stay, so bringing it back restores it as it was. */
export async function removePartner(actor: PlatformActor, partnerId: string) {
  requirePlatformAdmin(actor);
  await runInTransaction(async (tx) => {
    if (!(await partners.setPartnerRemoved(tx, partnerId, true))) throw notFound("Partner");
    await logPartner(actor, "partner.removed", partnerId, tx);
  });
}

export async function restorePartner(actor: PlatformActor, partnerId: string) {
  requirePlatformAdmin(actor);
  await runInTransaction(async (tx) => {
    if (!(await partners.setPartnerRemoved(tx, partnerId, false))) throw notFound("Removed partner");
    await logPartner(actor, "partner.restored", partnerId, tx);
  });
}

/** Days that are all over already would sponsor nothing, so they are refused. */
function refusePastDays(input: z.infer<typeof sponsorshipInput>, now: Date) {
  if (input.endsOn <= toIsoDate(todayUtc(now))) {
    throw invalid("These days are already over. Pick days from today on.");
  }
}

/** Sponsors a live partner for a set of days. */
export async function sponsorPartner(
  actor: PlatformActor,
  partnerId: string,
  input: z.infer<typeof sponsorshipInput>,
  now = new Date(),
) {
  requirePlatformAdmin(actor);
  refusePastDays(input, now);
  return runInTransaction(async (tx) => {
    if (!(await partners.findLivePartner(tx, partnerId))) throw notFound("Partner");
    const id = await partners.createSponsorship(tx, {
      partnerPlaceId: partnerId,
      startsOn: parseIsoDate(input.startsOn),
      endsOn: parseIsoDate(input.endsOn),
      createdById: actor.userId,
    });
    await logPartner(actor, "partner.sponsored", partnerId, tx);
    return { id };
  });
}

export async function endSponsorship(actor: PlatformActor, partnerId: string, sponsorshipId: string) {
  requirePlatformAdmin(actor);
  await runInTransaction(async (tx) => {
    if (!(await partners.removeSponsorship(tx, partnerId, sponsorshipId))) throw notFound("Sponsorship");
    await logPartner(actor, "partner.sponsorship_ended", partnerId, tx);
  });
}

/**
 * The partners near a place, for "Things to do near your stay": those of its region, sponsored ones first (marked
 * `sponsored`), then the nearest by map pin, then by name. A place with no region has none.
 */
export async function listNearbyPartners(
  place: { region: string | null; latitude: number | null; longitude: number | null },
  now = new Date(),
) {
  if (!place.region) return [];
  const here = mapPin(place.latitude, place.longitude);
  const rows = await partners.listPartnersInRegion(prisma, place.region, todayUtc(now));
  const withDistance = rows.map(({ latitude, longitude, ...partner }) => {
    const pin = mapPin(latitude, longitude);
    return { ...partner, distanceKm: here && pin ? Math.round(distanceKm(here, pin) * 10) / 10 : null };
  });
  return withDistance
    .sort(
      (a, b) =>
        Number(b.sponsored) - Number(a.sponsored) ||
        (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, NEARBY_LIMIT);
}

/**
 * The guesthouses featured from today on, for the admin: each with its place's name, soonest first. A place that has
 * closed since keeps its line, named by nobody, so the admin can still end it.
 */
export async function listFeaturedPlacesForAdmin(actor: PlatformActor, now = new Date()) {
  requirePlatformAdmin(actor);
  const rows = await partners.listPlaceSponsorships(prisma, todayUtc(now));
  const places = new Map(
    (await listPlacesByIds(rows.flatMap((row) => (row.businessId ? [row.businessId] : [])))).map((place) => [
      place.id,
      place,
    ]),
  );
  return rows.map((row) => {
    const place = row.businessId ? places.get(row.businessId) : undefined;
    return {
      id: row.id,
      placeName: place?.name ?? null,
      placeSlug: place?.slug ?? null,
      startsOn: toIsoDate(row.startsOn),
      endsOn: toIsoDate(row.endsOn),
    };
  });
}

/**
 * Features a guesthouse for a set of days: it comes first in search and on the home page, marked "Featured". This is
 * paid for outside the platform, like a sponsored partner. Only an open place can be featured.
 */
export async function featurePlace(
  actor: PlatformActor,
  input: z.infer<typeof featureInput>,
  now = new Date(),
) {
  requirePlatformAdmin(actor);
  refusePastDays(input, now);
  if ((await listPlacesByIds([input.businessId])).length === 0) throw notFound("Place");
  return runInTransaction(async (tx) => {
    const id = await partners.createSponsorship(tx, {
      businessId: input.businessId,
      startsOn: parseIsoDate(input.startsOn),
      endsOn: parseIsoDate(input.endsOn),
      createdById: actor.userId,
    });
    await recordPlatformAction(
      actor,
      { businessId: input.businessId, action: "place.featured", entity: "sponsorship", entityId: id },
      tx,
    );
    return { id };
  });
}

/** Ends a guesthouse's featured days at once. */
export async function endPlaceFeature(actor: PlatformActor, sponsorshipId: string) {
  requirePlatformAdmin(actor);
  await runInTransaction(async (tx) => {
    if (!(await partners.removePlaceSponsorship(tx, sponsorshipId))) throw notFound("Featured days");
    await recordPlatformAction(
      actor,
      { businessId: null, action: "place.feature_ended", entity: "sponsorship", entityId: sponsorshipId },
      tx,
    );
  });
}

/** The guesthouses featured today, for search and the home page to put first. */
export async function listFeaturedPlaceIds(now = new Date()): Promise<Set<string>> {
  return new Set(await partners.findFeaturedBusinessIds(prisma, todayUtc(now)));
}

/** The experiences and services sponsored today, for "Things to do near your stay", where they come first. */
export async function listSponsoredOfferingIds(now = new Date()): Promise<Set<string>> {
  return new Set(await partners.findSponsoredOfferingIds(prisma, todayUtc(now)));
}
