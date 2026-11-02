"use client";

import type { CSSProperties, ReactNode } from "react";
import { useInView } from "@/hooks/use-in-view";

/**
 * Plays the motion of what is inside the first time it scrolls into view: children marked `reveal-item` rise in one
 * after another (their `--stagger`), and a `journey-line` draws itself (both in globals.css). Without JavaScript
 * everything simply shows.
 */
export function Reveal({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  return (
    <div ref={ref} data-shown={inView ? "" : undefined} className={className} style={style}>
      {children}
    </div>
  );
}
