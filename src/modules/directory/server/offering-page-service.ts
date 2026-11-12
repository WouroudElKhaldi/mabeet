import { countTakenSeats } from "@/modules/bookings/server";
import { findPublicOffering, listOfferingsDuring, listPublicOfferings } from "@/modules/offerings/server";
import { listSponsoredOfferingIds } from "@/modules/partners/server";
import { listOfferingReviews } from "@/modules/reviews/server";
import type { OfferingKind } from "@/config/enums";
import { getPublicPlace } from "@/modules/workspaces/server";
import { addDays, type DateRange } from "@/utils/dates";
import { distanceKm, mapPin } from "@/utils/geo";
import type { NearbyOffering, OfferingCard, PublicOffering } from "../types";
import { getPublicHost } from "./directory-service";

// The guest's side of experiences and services. The offering and its sessions are the offerings module's; the seats
// taken are the booking engine's. They meet here, so neither has to read the other's tables.

/**
 * An experience or service's page, with the seats left in each upcoming session, its reviews and its host (the
 * place's, met as on the place's page). Null when guests cannot book it.
 */
export async function getOfferingPage(slug: string, now = new Date()): Promise<PublicOffering | null> {
  const offering = await findPublicOffering(slug, now);
  if (!offering) return null;
  const [taken, reviews, host] = await Promise.all([
    countTakenSeats(
      offering.sessions.map((session) => session.id),
      now,
    ),
    listOfferingReviews(offering.id),
    getPublicHost(offering.business.id, now),
  ]);
  const { business, sessions, kind, ...fields } = offering;
  return {
    ...fields,
    reviews,
    host,
    whatsapp: business.whatsapp,
    kind: kind === "SERVICE" ? "SERVICE" : "EXPERIENCE",
    business: {
      name: business.name,
      slug: business.slug,
      area: business.area,
      timezone: business.timezone,
      currency: business.currency,
    },
    bookingMode: business.bookingMode,
    sessions: sessions.map((session) => ({
      id: session.id,
      startsAt: session.startsAt.toISOString(),
      seatsLeft: Math.max(0, session.capacity - (taken.get(session.id) ?? 0)),
    })),
  };
}

/** Experiences or services of listed places, as cards for the browse tabs: the ones with a date coming first. */
export async function browseOfferings(
  kind: OfferingKind,
  take: number,
  now = new Date(),
): Promise<OfferingCard[]> {
  const rows = await listPublicOfferings({ kind, take }, now);
  return rows.map((row) => ({
    slug: row.slug,
    kind,
    title: row.title,
    categorySlug: row.categorySlug,
    area: row.area,
    durationMinutes: row.durationMinutes,
    priceCents: row.priceCents,
    priceUnit: row.priceUnit,
    currency: row.business.currency,
    timezone: row.business.timezone,
    photo: row.photos[0] ?? null,
    nextStartsAt: row.sessions[0]?.startsAt ?? null,
  }));
}

/** Most experiences "Things to do near your stay" shows. */
const NEAR_STAY_LIMIT = 12;

/**
 * Experiences and services a guest could join during their stay at a place (F22): of the place's region, with a
 * session with seats left from the check-in day to the end of the check-out day (the guest is still there that
 * morning), sponsored
 * ones first, then the nearest by map pin, then the soonest. A closed place, or one with no region, has none.
 */
export async function listOfferingsNearStay(
  slug: string,
  range: DateRange,
  now = new Date(),
): Promise<NearbyOffering[]> {
  const place = await getPublicPlace(slug);
  if (!place?.region) return [];
  const from = range.checkIn > now ? range.checkIn : now;
  const to = addDays(range.checkOut, 1);
  if (from >= to) return [];
  const [rows, sponsored] = await Promise.all([
    listOfferingsDuring(place.region, from, to),
    listSponsoredOfferingIds(now),
  ]);
  const taken = await countTakenSeats(
    rows.flatMap((row) => row.sessions.map((session) => session.id)),
    now,
  );
  const here = mapPin(place.latitude, place.longitude);
  const found = rows.flatMap((row) => {
    const open = row.sessions.find((session) => session.capacity > (taken.get(session.id) ?? 0));
    if (!open) return [];
    const pin = mapPin(row.latitude, row.longitude);
    const startsAt = open.startsAt;
    const card: NearbyOffering = {
      slug: row.slug,
      kind: row.kind === "SERVICE" ? "SERVICE" : "EXPERIENCE",
      title: row.title,
      categorySlug: row.categorySlug,
      area: row.area,
      durationMinutes: row.durationMinutes,
      priceCents: row.priceCents,
      priceUnit: row.priceUnit,
      currency: row.business.currency,
      timezone: row.business.timezone,
      photo: row.photos[0] ?? null,
      nextStartsAt: startsAt,
      sponsored: sponsored.has(row.id),
      distanceKm: here && pin ? Math.round(distanceKm(here, pin) * 10) / 10 : null,
    };
    return [card];
  });
  const far = (card: NearbyOffering) => card.distanceKm ?? Number.POSITIVE_INFINITY;
  const soon = (card: NearbyOffering) => card.nextStartsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return found
    .sort((a, b) => Number(b.sponsored) - Number(a.sponsored) || far(a) - far(b) || soon(a) - soon(b))
    .slice(0, NEAR_STAY_LIMIT);
}
