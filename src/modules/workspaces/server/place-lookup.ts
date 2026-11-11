import { prisma } from "@/server/db/client";
import * as businesses from "./business-repository";
import type { PlaceFilters } from "./business-repository";

// What other modules read about a place.

/**
 * A place's public page, by its link: what any visitor may see. Null when there is no such place, or it is paused
 * or deleted. An unlisted place still has its page (its link is shared on Instagram); only search leaves it out.
 */
export function getPublicPlace(slug: string) {
  return businesses.findPublicBusinessBySlug(prisma, slug);
}

/** A place guests can book, by its public link, with the settings a new booking copies. Null when there is none. */
export function findBookablePlace(slug: string) {
  return businesses.findBookableBusinessBySlug(prisma, slug);
}

/**
 * For calendar sync: the place's name (it titles each room's calendar link) and its time zone (a platform's
 * date-times are read as dates at the place). Null when the place is deleted.
 */
export function findPlaceForCalendar(businessId: string) {
  return businesses.findPlaceForCalendar(prisma, businessId);
}

/**
 * For analytics: each place's name, currency, commission rate and how it is booked. A plain read: the caller checks
 * the member may read its numbers.
 */
export function findPlacesForReports(businessIds: readonly string[]) {
  return businesses.findPlacesForReports(prisma, businessIds);
}

/** Each place's name by its id, whatever its status: for the admin's money tables. */
export async function listPlaceNames(businessIds: readonly string[]) {
  const rows = await businesses.findBusinessNames(prisma, businessIds);
  return new Map(rows.map((row) => [row.id, row.name]));
}

/**
 * The places a guest saved, by id, with their categories as slugs: the same card fields as search. Unlisted places
 * are kept (their page still works and the guest chose them); paused and deleted ones are not.
 */
export async function listPlacesByIds(businessIds: readonly string[]) {
  const places = await businesses.findBusinessesByIds(prisma, businessIds);
  return places.map(({ categories, ...place }) => ({
    ...place,
    categories: categories.map((category) => category.categorySlug),
  }));
}

/**
 * For search: the listed places matching `filters`, at most `take`, with their categories as slugs. A place the owner
 * has not listed keeps its page but is never found here.
 */
export async function listListedPlaces(filters: PlaceFilters, take: number) {
  const places = await businesses.findListedBusinesses(prisma, filters, take);
  return places.map(({ categories, ...place }) => ({
    ...place,
    categories: categories.map((category) => category.categorySlug),
  }));
}
