import type { Db } from "@/server/db/client";

// Website-wide settings: a single row with id "site".

const SITE_ID = "site";

export function findSiteSettings(db: Db) {
  return db.siteSetting.findUnique({ where: { id: SITE_ID } });
}
