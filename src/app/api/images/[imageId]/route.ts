import { imageParams } from "@/modules/rooms";
import { getImage } from "@/modules/rooms/server";
import { notFound } from "@/server/errors";
import { parseParams, route } from "@/server/http/route";

/**
 * Serves an uploaded photo kept in Postgres, or sends the caller to it in R2. Each upload gets a new id, so the
 * bytes behind an id never change: cached forever.
 */
export const GET = route(async (_request, context) => {
  const { imageId } = await parseParams(context, imageParams);
  const image = await getImage(imageId);
  if (!image) throw notFound("Image");
  if ("redirectTo" in image) return Response.redirect(image.redirectTo, 301);
  return new Response(image.bytes, {
    headers: { "content-type": image.mimeType, "cache-control": "public, max-age=31536000, immutable" },
  });
});
