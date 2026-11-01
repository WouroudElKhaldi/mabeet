import Link from "next/link";
import type { CSSProperties } from "react";
import { BRAND } from "@/config/brand";

// The logo's shapes (public/brand, cut from docs/brand/mabeet-logo.png) are used as masks, so they take the site's
// colours: the arch and the name in the palette's accent, the landscape inside the arch a lighter tone of it. Every
// palette, light and dark, then wears its own logo.
function logoShape(file: string): CSSProperties {
  return {
    maskImage: `url(/brand/${file})`,
    maskSize: "contain",
    maskRepeat: "no-repeat",
    maskPosition: "center",
  };
}

/** Mabeet's logo: the arch opening onto a landscape, and the name. It reads left to right in every language. */
export function Wordmark() {
  return (
    <Link href="/" dir="ltr" className="inline-flex items-center gap-2.5 text-accent" aria-label={BRAND.name}>
      <span aria-hidden className="relative h-9 w-[2.05rem] shrink-0">
        <span className="absolute inset-0 bg-current" style={logoShape("mabeet-arch.png")} />
        <span className="absolute inset-0 bg-current opacity-70" style={logoShape("mabeet-scene.png")} />
      </span>
      <span
        aria-hidden
        className="h-[1.3rem] w-24 shrink-0 bg-current"
        style={logoShape("mabeet-word.png")}
      />
    </Link>
  );
}
