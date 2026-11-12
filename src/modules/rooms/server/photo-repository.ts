import type { PhotoArea, Prisma } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

// The galleries the host manages: the place's own photos (no room and no offering), each room's, and each
// experience or service's. A photo's file is a StoredImage: in R2, or kept in Postgres when R2 is not set up.

export interface Gallery {
  businessId: string;
  /** A room's gallery; null for the place's own photos or an offering's. */
  roomId: string | null;
  /** An experience or service's gallery; null otherwise. Never set together with `roomId`. */
  offeringId: string | null;
}

const galleryWhere = (gallery: Gallery): Prisma.PhotoWhereInput => ({
  businessId: gallery.businessId,
  roomId: gallery.roomId,
  offeringId: gallery.offeringId,
  isDeleted: false,
});

export function listPhotos(db: Db, gallery: Gallery) {
  return db.photo.findMany({
    where: galleryWhere(gallery),
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, url: true, alt: true, area: true, position: true },
  });
}

export function countPhotos(db: Db, gallery: Gallery) {
  return db.photo.count({ where: galleryWhere(gallery) });
}

/** Where an upload's file is: already in R2 (served from its public address), or kept in Postgres. */
export type StoredFile = { storageKey: string; publicUrl: string } | { bytes: Uint8Array<ArrayBuffer> };

/**
 * Records the upload and adds the photo at the end of the gallery. Call it inside the transaction: the file row and
 * the photo are saved together, or neither is. A file kept in Postgres is served by /api/images/{id}.
 */
export async function addUploadedPhoto(
  tx: Tx,
  gallery: Gallery,
  image: { mimeType: string; size: number; file: StoredFile; alt: string | null; area: PhotoArea | null },
) {
  const inR2 = "storageKey" in image.file ? image.file : null;
  const stored = await tx.storedImage.create({
    data: {
      businessId: gallery.businessId,
      mimeType: image.mimeType,
      size: image.size,
      storageKey: inR2?.storageKey,
      bytes: "bytes" in image.file ? image.file.bytes : undefined,
    },
    select: { id: true },
  });
  const last = await tx.photo.aggregate({ where: galleryWhere(gallery), _max: { position: true } });
  return tx.photo.create({
    data: {
      businessId: gallery.businessId,
      roomId: gallery.roomId,
      offeringId: gallery.offeringId,
      url: inR2?.publicUrl ?? `/api/images/${stored.id}`,
      storedImageId: stored.id,
      alt: image.alt,
      area: image.area,
      position: (last._max.position ?? -1) + 1,
    },
    select: { id: true, url: true, alt: true, area: true, position: true },
  });
}

export function findPhoto(db: Db, businessId: string, photoId: string) {
  return db.photo.findFirst({
    where: { id: photoId, businessId, isDeleted: false },
    select: { id: true, roomId: true, offeringId: true, storedImageId: true },
  });
}

/** Tags a photo with the part of the place it shows, and its caption, for the photo tour. */
export async function describePhoto(
  db: Db,
  businessId: string,
  photoId: string,
  data: { area?: PhotoArea | null; alt?: string | null },
): Promise<boolean> {
  const { count } = await db.photo.updateMany({ where: { id: photoId, businessId, isDeleted: false }, data });
  return count > 0;
}

/** Puts a photo first in its gallery: the cover shown on cards. */
export async function makeCover(tx: Tx, gallery: Gallery, photoId: string): Promise<boolean> {
  const first = await tx.photo.aggregate({ where: galleryWhere(gallery), _min: { position: true } });
  const { count } = await tx.photo.updateMany({
    where: { ...galleryWhere(gallery), id: photoId },
    data: { position: (first._min.position ?? 0) - 1 },
  });
  return count > 0;
}

/**
 * Marks a photo deleted, and its upload. The file itself is kept (in R2 or in Postgres), like every other deleted
 * row, but /api/images stops serving it.
 */
export async function deletePhoto(
  tx: Tx,
  businessId: string,
  photo: { id: string; storedImageId: string | null },
) {
  await tx.photo.update({ where: { id: photo.id }, data: { isDeleted: true } });
  if (photo.storedImageId) {
    await tx.storedImage.updateMany({
      where: { id: photo.storedImageId, businessId },
      data: { isDeleted: true },
    });
  }
}

/** For /api/images/{id}: a live upload's file, where it is. */
export function findStoredImage(db: Db, imageId: string) {
  return db.storedImage.findFirst({
    where: { id: imageId, isDeleted: false },
    select: { mimeType: true, bytes: true, storageKey: true },
  });
}
