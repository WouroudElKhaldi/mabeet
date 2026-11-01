import Link from "next/link";
import { BRAND } from "@/config/brand";

/** A doorway arch (Lebanese triple-arch houses) with the name beside it, in the site's accent colour. */
export function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-accent" aria-label={BRAND.name}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <path
          d="M5 28V15a11 11 0 0 1 22 0v13"
          className="fill-none stroke-current"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M11 28v-8a5 5 0 0 1 10 0v8" className="fill-current" />
      </svg>
      <span className="text-[1.375rem] leading-none font-bold tracking-tight">{BRAND.name}</span>
    </Link>
  );
}
