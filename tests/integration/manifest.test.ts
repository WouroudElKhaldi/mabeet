import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { BRAND } from "@/config/brand";

// What a phone needs to install Mabeet: a name, full screen, and icons in the site's palette that exist.

describe("the install manifest", () => {
  it("opens full screen from the home page, with the site palette's icons", async () => {
    const app = await manifest();
    expect(app).toMatchObject({ short_name: BRAND.name, start_url: "/", display: "standalone" });
    const sources = (app.icons ?? []).map((icon) => icon.src);
    expect(sources).toHaveLength(2);
    for (const source of sources) expect(source).toMatch(/^\/brand\/icons\/[a-z]+\/(icon|apple-icon)\.png$/);
  });
});
