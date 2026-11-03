import { connection } from "next/server";
import { getSitePalette } from "@/modules/admin/server";

/**
 * Browsers and link previews that ask for /favicon.ico directly get the icon in the site's palette (pages name it in
 * their head; see generateMetadata in layout.tsx).
 */
export async function GET() {
  // Read on each request, never while the site is built: the build has no database, and the palette can change.
  await connection();
  const palette = await getSitePalette();
  // A relative address: behind nginx, the request's own URL is the server's localhost:3000, not the visitor's.
  return new Response(null, { status: 307, headers: { Location: `/brand/icons/${palette}/favicon.ico` } });
}
