import { z } from "zod";
import { sitePaletteInput } from "@/modules/admin";
import { setSitePalette } from "@/modules/admin/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** A platform admin sets the website's colour palette. */
export const PATCH = adminRoute(z.object({}), async ({ request, actor }) => {
  const { palette } = await parseBody(request, sitePaletteInput);
  await setSitePalette(actor, palette);
  return json({ ok: true });
});
