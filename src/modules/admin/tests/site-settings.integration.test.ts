import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPlatformAdmin, prisma } from "@tests/integration/helpers";
import { getSitePalette, setSitePalette } from "../server";

// The whole website wears the palette the super admin saved. The settings are one shared row, so these tests put back
// whatever was there before them.

const SITE_ID = "site";
let before: { palette: string } | null = null;

beforeAll(async () => {
  before = await prisma.siteSetting.findUnique({ where: { id: SITE_ID }, select: { palette: true } });
});

afterAll(async () => {
  if (before) await prisma.siteSetting.update({ where: { id: SITE_ID }, data: { palette: before.palette } });
  else await prisma.siteSetting.delete({ where: { id: SITE_ID } });
});

const savePalette = (palette: string) =>
  prisma.siteSetting.upsert({
    where: { id: SITE_ID },
    create: { id: SITE_ID, palette },
    update: { palette },
  });

describe("the site palette", () => {
  it("is the one the super admin saved", async () => {
    await savePalette("batroun");
    expect(await getSitePalette()).toBe("batroun");
  });

  it("falls back to Cedar when the saved value is not a palette the site has", async () => {
    await savePalette("neon");
    expect(await getSitePalette()).toBe("cedar");
  });

  it("is saved by a platform admin, under their name", async () => {
    const admin = await createPlatformAdmin();
    await setSitePalette(admin, "byblos");
    expect(await getSitePalette()).toBe("byblos");
    expect(
      await prisma.auditLog.count({ where: { actorId: admin.userId, action: "site.palette_changed" } }),
    ).toBe(1);
  });
});
