"use client";

import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

/** A row that scrolls sideways, with round arrow buttons that appear only when there is more to see. */
export function ScrollRail({
  children,
  label,
  labels,
}: {
  children: ReactNode;
  label: string;
  labels: { previous: string; next: string };
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const element = rail.current;
    if (!element) return;
    // Right to left, scrollLeft runs negative; its size is what counts.
    const scrolled = Math.abs(element.scrollLeft);
    setEdges({ start: scrolled < 4, end: scrolled + element.clientWidth >= element.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const scroll = (direction: 1 | -1) => {
    const element = rail.current;
    if (!element) return;
    const rtl = getComputedStyle(element).direction === "rtl";
    element.scrollBy({ left: direction * (rtl ? -1 : 1) * element.clientWidth * 0.7, behavior: "smooth" });
  };

  const arrow =
    "absolute top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-surface shadow-soft ring-1 ring-line-strong transition-transform hover:scale-105";

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={rail}
        onScroll={measure}
        role="group"
        aria-label={label}
        className="scrollbar-none flex gap-8 overflow-x-auto scroll-smooth"
      >
        {children}
      </div>
      {!edges.start && (
        <>
          <div className="pointer-events-none absolute inset-y-0 start-0 w-16 bg-gradient-to-r from-paper to-transparent rtl:bg-gradient-to-l" />
          <button
            type="button"
            aria-label={labels.previous}
            onClick={() => scroll(-1)}
            className={clsx(arrow, "start-0")}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          </button>
        </>
      )}
      {!edges.end && (
        <>
          <div className="pointer-events-none absolute inset-y-0 end-0 w-16 bg-gradient-to-l from-paper to-transparent rtl:bg-gradient-to-r" />
          <button
            type="button"
            aria-label={labels.next}
            onClick={() => scroll(1)}
            className={clsx(arrow, "end-0")}
          >
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
