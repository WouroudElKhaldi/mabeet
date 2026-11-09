import { cache } from "react";
import { DEFAULT_PALETTE, isPalette, type Palette } from "@/config/appearance";
import { recordPlatformAction } from "@/modules/audit/server";
import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { findSiteSettings, saveSitePalette } from "./site-repository";

/** The colour palette the super admin chose for the whole website. Read once per request. */
export const getSitePalette = cache(async (): Promise<Palette> => {
  const settings = await findSiteSettings(prisma);
  return settings && isPalette(settings.palette) ? settings.palette : DEFAULT_PALETTE;
});

/** The website's palette is a platform decision; visitors only choose light or dark. Logged like every admin action. */
export async function setSitePalette(actor: PlatformActor, palette: Palette) {
  requirePlatformAdmin(actor);
  await saveSitePalette(prisma, palette, actor.userId);
  await recordPlatformAction(actor, {
    businessId: null,
    action: "site.palette_changed",
    entity: "site",
    entityId: "site",
  });
}
