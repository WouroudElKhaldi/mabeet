import sharp from "sharp";

// Phone photos arrive at 3 to 8 MB. Re-encoding them as WebP at a size no screen needs more than keeps them
// looking the same at a fraction of the bytes. The EXIF rotation is applied first, and all metadata (camera,
// GPS location) is dropped.

const LONGEST_SIDE = 1600;
const QUALITY = 82;

export interface OptimizedImage {
  bytes: Uint8Array<ArrayBuffer>;
  mimeType: "image/webp";
}

/** Upright, at most 1600 px on its longest side, as WebP. Smaller images keep their size. */
export async function optimizeImage(input: Uint8Array): Promise<OptimizedImage> {
  const output = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: LONGEST_SIDE, height: LONGEST_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
  return { bytes: new Uint8Array(output), mimeType: "image/webp" };
}
