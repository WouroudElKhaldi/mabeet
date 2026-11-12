import { countTakenSeats } from "@/modules/bookings/server";
import { findPublicOffering, listPublicOfferings } from "@/modules/offerings/server";
import { listOfferingReviews } from "@/modules/reviews/server";
import type { OfferingKind } from "@/config/enums";
import type { OfferingCard, PublicOffering } from "../types";
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
