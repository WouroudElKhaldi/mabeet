import { photoChange, photoParams } from "@/modules/rooms";
import { describePhoto, removePhoto, setCoverPhoto } from "@/modules/rooms/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** `{ "cover": true }` puts the photo first in its gallery; `{ area, alt }` tags it for the photo tour. */
export const PATCH = tenantRoute(photoParams, async ({ request, ctx, params: { photoId } }) => {
  const change = await parseBody(request, photoChange);
  if ("cover" in change) await setCoverPhoto(ctx, photoId);
  else await describePhoto(ctx, photoId, change);
  return json({ ok: true });
});

/** Deletes a photo. Its file is kept, like every deleted row, but is no longer served. */
export const DELETE = tenantRoute(photoParams, async ({ ctx, params: { photoId } }) => {
  await removePhoto(ctx, photoId);
  return json({ ok: true });
});
