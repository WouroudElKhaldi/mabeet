import type { PhotoArea } from "@prisma/client";
import { PHOTO_AREAS } from "@/config/enums";
import type { PublicPhoto, PublicUnit } from "./types";

// How the photo tour is ordered: the place's own photos first, by part of the house, then each room with its own.
// A group is never empty, and a photo is never in two groups, so what a guest counts is what they see.

/** One heading of the photo tour, with the photos under it. */
export type PhotoGroup =
  | { id: string; kind: "area"; area: PhotoArea; photos: PublicPhoto[] }
  | { id: string; kind: "room"; name: string; photos: PublicPhoto[] };

/**
 * The place's photos grouped by the part of the house they show, in the order the list of areas gives, then each
 * room that has photos. Photos the host never placed come last, under "Additional photos" (`OTHER`), so nothing is
 * hidden by having been skipped.
 */
export function groupPhotos(placePhotos: readonly PublicPhoto[], units: readonly PublicUnit[]): PhotoGroup[] {
  const byArea = new Map<PhotoArea, PublicPhoto[]>();
  for (const photo of placePhotos) {
    const area = photo.area ?? "OTHER";
    const group = byArea.get(area);
    if (group) group.push(photo);
    else byArea.set(area, [photo]);
  }
  const areas = PHOTO_AREAS.flatMap<PhotoGroup>((area) => {
    const photos = byArea.get(area);
    return photos ? [{ id: `area-${area}`, kind: "area", area, photos }] : [];
  });
  const rooms = units.flatMap<PhotoGroup>((unit) =>
    unit.photos.length > 0
      ? [{ id: `room-${unit.id}`, kind: "room", name: unit.name, photos: unit.photos }]
      : [],
  );
  return [...areas, ...rooms];
}

/** How many photos the tour holds, for the link that leads to it. */
export const countPhotos = (groups: readonly PhotoGroup[]): number =>
  groups.reduce((total, group) => total + group.photos.length, 0);
