"use client";

import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";

/** Sticky white header with a hairline; a soft shadow appears once the page scrolls. */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={clsx(
        "sticky top-0 z-40 border-b border-line bg-paper transition-shadow duration-200",
        scrolled && "shadow-soft",
      )}
    >
      {children}
    </header>
  );
}
