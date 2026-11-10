import { prisma } from "@/server/db/client";
import { getPublicPlace } from "@/modules/workspaces/server";
import { notFound } from "@/server/errors";
import type { PlaceCard } from "../types";
import { listSavedPlaces } from "./directory-service";
import * as favorites from "./favorite-repository";

// The places a guest saved. Saving is about a place, never about a stay, so no dates and no prices are kept: the
// list shows what each place costs today.

/**
 * Saves a place for a guest, or takes it off their list. Asking twice for the same thing is not an error: the
 * heart on the page and the list in the account can be out of step, and the guest's last tap decides.
 */
export async function setFavorite(userId: string, slug: string, saved: boolean): Promise<void> {
  const place = await getPublicPlace(slug);
  if (!place) throw notFound("Place");
  if (saved) await favorites.saveFavorite(prisma, userId, place.id);
  else await favorites.removeFavorite(prisma, userId, place.id);
}

/** Whether this guest has this place saved, for the heart on its page. Unknown places are simply not saved. */
export async function isPlaceSaved(userId: string, slug: string): Promise<boolean> {
  const place = await getPublicPlace(slug);
  return place ? favorites.isFavorite(prisma, userId, place.id) : false;
}

/** The guest's saved places, the newest first, as cards. */
export async function listMyFavorites(userId: string): Promise<PlaceCard[]> {
  return listSavedPlaces(await favorites.listFavoriteIds(prisma, userId));
}
