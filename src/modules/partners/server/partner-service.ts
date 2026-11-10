import type { z } from "zod";
import { recordPlatformAction } from "@/modules/audit/server";
import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { type Db, prisma, runInTransaction } from "@/server/db/client";
import { invalid, notFound } from "@/server/errors";
import { parseIsoDate, todayUtc, toIsoDate } from "@/utils/dates";
import { distanceKm, mapPin } from "@/utils/geo";
import type { partnerInput, sponsorshipInput } from "../schemas";
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

/** Sponsors a live partner for a set of days. Days that are all over already would sponsor nothing, so they are refused. */
export async function sponsorPartner(
  actor: PlatformActor,
  partnerId: string,
  input: z.infer<typeof sponsorshipInput>,
  now = new Date(),
) {
  requirePlatformAdmin(actor);
  if (input.endsOn <= toIsoDate(todayUtc(now))) {
    throw invalid("These days are already over. Pick days from today on.");
  }
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
