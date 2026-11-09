import type { Palette } from "@/config/appearance";
import type { Db } from "@/server/db/client";

// Website-wide settings: a single row with id "site".

const SITE_ID = "site";

export function findSiteSettings(db: Db) {
  return db.siteSetting.findUnique({ where: { id: SITE_ID } });
}

/** Saves the palette on the one settings row, creating it the first time. */
export function saveSitePalette(db: Db, palette: Palette, updatedById: string) {
  return db.siteSetting.upsert({
    where: { id: SITE_ID },
    create: { id: SITE_ID, palette, updatedById },
    update: { palette, updatedById },
  });
}
