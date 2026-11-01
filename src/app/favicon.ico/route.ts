import { getSitePalette } from "@/modules/admin/server";

/**
 * Browsers and link previews that ask for /favicon.ico directly get the icon in the site's palette (pages name it in
 * their head; see generateMetadata in layout.tsx).
 */
export async function GET(request: Request) {
  const palette = await getSitePalette();
  return Response.redirect(new URL(`/brand/icons/${palette}/favicon.ico`, request.url), 307);
}
