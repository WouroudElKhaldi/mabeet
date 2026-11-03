import { prisma } from "@/server/db/client";
import * as businesses from "./business-repository";

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
 * For analytics: each place's name, currency, commission rate and how it is booked. A plain read: the caller checks
 * the member may read its numbers.
 */
export function findPlacesForReports(businessIds: readonly string[]) {
  return businesses.findPlacesForReports(prisma, businessIds);
}
