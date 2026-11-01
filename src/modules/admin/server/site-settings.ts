import { cache } from "react";
import { DEFAULT_PALETTE, isPalette, type Palette } from "@/config/appearance";
import { prisma } from "@/server/db/client";
import { findSiteSettings } from "./site-repository";

/** The colour palette the super admin chose for the whole website. Read once per request. */
export const getSitePalette = cache(async (): Promise<Palette> => {
  const settings = await findSiteSettings(prisma);
  return settings && isPalette(settings.palette) ? settings.palette : DEFAULT_PALETTE;
});
