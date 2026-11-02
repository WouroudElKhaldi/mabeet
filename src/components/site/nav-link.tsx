"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * A link in the site header. On hover or keyboard focus a short bar in the palette's glow grows under the word from
 * the reading side (`nav-link` in globals.css); on the page it leads to, the bar stays, so the menu shows where you are.
 */
export function NavLink({ href, className, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={clsx("nav-link relative rounded-full px-4 py-2.5", className)}
      {...props}
    />
  );
}
