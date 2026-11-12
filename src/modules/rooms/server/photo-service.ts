import type { PhotoArea } from "@prisma/client";
import { recordAction } from "@/modules/audit/server";
import { offeringExists } from "@/modules/offerings/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { invalid, notFound } from "@/server/errors";
import { optimizeImage } from "@/server/storage/optimize-image";
import { deleteObject, publicUrl, putObject, r2Enabled } from "@/server/storage/r2";
import { secureToken } from "@/utils/tokens";
import * as photos from "./photo-repository";
import * as rooms from "./room-repository";

// The host's photos: the place's own gallery, each room's, and each experience or service's. The place's and the
// rooms' need rooms.manage, the same permission as rooms and prices; an offering's needs offerings.manage, like the
// offering itself. A file is checked by its own bytes, shrunk to WebP, then kept in R2 (or in Postgres without R2). R2 is
// never called inside the transaction: the file goes up first, and if its rows cannot be saved it is removed again.

const MAX_BYTES = 2_500_000;
const MAX_PHOTOS = 20;

/** Real file signatures, so a renamed file cannot pass as an image. */
const SIGNATURES: Array<{ mimeType: string; matches: (bytes: Uint8Array) => boolean }> = [
  { mimeType: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mimeType: "image/png",
    matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mimeType: "image/webp",
    matches: (b) =>
      String.fromCharCode(...b.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...b.subarray(8, 12)) === "WEBP",
  },
];

const isImage = (bytes: Uint8Array) => SIGNATURES.some((signature) => signature.matches(bytes));

/** Which gallery a photo goes in: a room's, an offering's, or (neither) the place's own. */
interface GalleryOwner {
  roomId: string | null;
  offeringId: string | null;
}

/** Whose gallery, checked: the room or the offering must be this place's. */
async function galleryOf(ctx: TenantContext, owner: GalleryOwner): Promise<photos.Gallery> {
  const gallery = { businessId: ctx.businessId, roomId: owner.roomId, offeringId: owner.offeringId };
  if (owner.offeringId) {
    requirePermission(ctx, "offerings.manage");
    if (owner.roomId) throw invalid("A photo belongs to a room or to an experience, not both");
    if (!(await offeringExists(ctx.businessId, owner.offeringId))) throw notFound("Experience");
    return gallery;
  }
  requirePermission(ctx, "rooms.manage");
  if (owner.roomId && !(await rooms.findRoomForBooking(prisma, ctx.businessId, owner.roomId))) {
    throw notFound("Room");
  }
  return gallery;
}

/** A gallery in the host's order, for the photos screen. */
export async function listGallery(ctx: TenantContext, roomId: string | null) {
  return photos.listPhotos(prisma, await galleryOf(ctx, { roomId, offeringId: null }));
}

interface Upload extends GalleryOwner {
  bytes: Uint8Array<ArrayBuffer>;
  alt: string | null;
  area: PhotoArea | null;
}

export async function uploadPhoto(ctx: TenantContext, upload: Upload) {
  const gallery = await galleryOf(ctx, upload);
  if (upload.bytes.byteLength === 0) throw invalid("The file is empty");
  if (upload.bytes.byteLength > MAX_BYTES) throw invalid("Photos must be smaller than 2.5 MB");
  if (!isImage(upload.bytes)) throw invalid("Upload a JPEG, PNG or WebP photo");
  if ((await photos.countPhotos(prisma, gallery)) >= MAX_PHOTOS) {
    throw invalid(`A gallery holds up to ${MAX_PHOTOS} photos. Delete one first.`);
  }
  // Every photo is stored the same way: upright, at most 1600 px, as WebP, without its metadata.
  const image = await optimizeImage(upload.bytes).catch(() => {
    throw invalid("Upload a JPEG, PNG or WebP photo");
  });

  const storageKey = r2Enabled() ? `photos/${ctx.businessId}/${secureToken(16)}.webp` : null;
  if (storageKey) await putObject(storageKey, image.bytes, image.mimeType);
  try {
    return await runInTransaction(async (tx) => {
      const photo = await photos.addUploadedPhoto(tx, gallery, {
        mimeType: image.mimeType,
        size: image.bytes.byteLength,
        file: storageKey ? { storageKey, publicUrl: publicUrl(storageKey) } : { bytes: image.bytes },
        alt: upload.alt,
        area: upload.area,
      });
      await recordAction(ctx, "photo.added", "photo", photo.id, tx);
      return photo;
    });
  } catch (error) {
    // The rows were not saved, so the file in R2 belongs to nothing: take it back down.
    if (storageKey) {
      await deleteObject(storageKey).catch((undo: unknown) =>
        console.error(`[photos] could not remove the unsaved upload ${storageKey}`, undo),
      );
    }
    throw error;
  }
}

async function loadPhoto(ctx: TenantContext, photoId: string) {
  const photo = await photos.findPhoto(prisma, ctx.businessId, photoId);
  if (!photo) throw notFound("Photo");
  return { photo, gallery: await galleryOf(ctx, photo) };
}

export async function removePhoto(ctx: TenantContext, photoId: string) {
  const { photo } = await loadPhoto(ctx, photoId);
  await runInTransaction(async (tx) => {
    await photos.deletePhoto(tx, ctx.businessId, photo);
    await recordAction(ctx, "photo.removed", "photo", photoId, tx);
  });
}

/** Puts a photo first in its gallery: the cover shown on cards. */
export async function setCoverPhoto(ctx: TenantContext, photoId: string) {
  const { gallery } = await loadPhoto(ctx, photoId);
  await runInTransaction(async (tx) => {
    await photos.makeCover(tx, gallery, photoId);
    await recordAction(ctx, "photo.cover", "photo", photoId, tx);
  });
}

/** Which part of the place a photo shows (living room, kitchen…), and its caption, for the photo tour. */
export async function describePhoto(
  ctx: TenantContext,
  photoId: string,
  data: { area?: PhotoArea | null; alt?: string | null },
) {
  await loadPhoto(ctx, photoId);
  await photos.describePhoto(prisma, ctx.businessId, photoId, data);
}

/**
 * Public: what /api/images/{id} serves. Photos are public once on a listing. One kept in R2 is served by
 * Cloudflare, so the caller is sent there. Null for an unknown or deleted upload.
 */
export async function getImage(
  imageId: string,
): Promise<{ redirectTo: string } | { mimeType: string; bytes: Uint8Array<ArrayBuffer> } | null> {
  const image = await photos.findStoredImage(prisma, imageId);
  if (!image) return null;
  if (image.storageKey) return { redirectTo: publicUrl(image.storageKey) };
  return image.bytes ? { mimeType: image.mimeType, bytes: image.bytes } : null;
}
