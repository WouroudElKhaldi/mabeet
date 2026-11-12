import { workspaceParams } from "@/lib/schemas";
import { photoUploadFields } from "@/modules/rooms";
import { uploadPhoto } from "@/modules/rooms/server";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseUpload, tenantRoute } from "@/server/http/route";

/**
 * Uploads a photo (multipart: `file`, and `roomId` for a room's photo, `offeringId` for an experience's or service's,
 * or neither for the place's; `alt`, `area`).
 * JPEG, PNG or WebP up to 2.5 MB; it is stored as WebP.
 */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await enforceRateLimit(`photos:${ctx.userId}`, 60, 60 * 60_000);
  const { bytes, fields } = await parseUpload(request, photoUploadFields);
  return json(await uploadPhoto(ctx, { ...fields, bytes }), 201);
});
