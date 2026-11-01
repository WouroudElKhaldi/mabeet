import { prisma } from "@/server/db/client";
import * as businesses from "./business-repository";

// What other modules read about a place.

/** A place guests can book, by its public link, with the settings a new booking copies. Null when there is none. */
export function findBookablePlace(slug: string) {
  return businesses.findBookableBusinessBySlug(prisma, slug);
}
