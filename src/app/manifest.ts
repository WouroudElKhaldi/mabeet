import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";
import { getSitePalette } from "@/modules/admin/server";

/**
 * Makes Mabeet installable on phones and computers: from the browser's menu (or Share, Add to Home Screen on an
 * iPhone) it opens full screen like an app. The icon wears the site's palette, like the tab icon.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const icons = `/brand/icons/${await getSitePalette()}`;
  return {
    name: `${BRAND.name} · ${BRAND.nameAr}`,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The light theme's page colour, so the splash screen matches the first page.
    background_color: "#fbf8f1",
    theme_color: BRAND.accent,
    icons: [
      // One 512 pixel image; browsers scale it to the 192 they also ask for.
      { src: `${icons}/icon.png`, sizes: "192x192 512x512", type: "image/png", purpose: "any" },
      { src: `${icons}/apple-icon.png`, sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
