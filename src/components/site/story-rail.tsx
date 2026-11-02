"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { type ReactNode, useRef } from "react";
import { LogoMark } from "./wordmark";

/**
 * Ties the parts of a long page into one journey: a dashed line runs down the reading side, fills with the accent as
 * the visitor scrolls, and the Mabeet mark travels along it. Put `StoryChapter`s inside; each sits on the line with
 * its own stop. Reduced motion shows the line already full and the mark still at the end.
 */
export function StoryRail({ children }: { children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: rail, offset: ["start 70%", "end 70%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });
  const travelled = useTransform(progress, (value) => `${(reduceMotion ? 1 : value) * 100}%`);
  const filled = useTransform(progress, (value) => (reduceMotion ? 1 : value));

  return (
    <div ref={rail} className="relative ps-12 sm:ps-20">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 start-4 w-0 sm:start-8">
        <span className="absolute inset-y-0 -start-px border-s-2 border-dashed border-line-strong" />
        <motion.span
          className="absolute -start-[1.5px] top-0 h-full w-[3px] origin-top rounded-full bg-accent"
          style={{ scaleY: filled }}
        />
        <motion.span
          className="absolute start-0 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-accent-ink shadow-lift ring-4 ring-paper rtl:translate-x-1/2"
          style={{ top: travelled }}
        >
          <LogoMark className="h-5 w-[1.14rem]" />
        </motion.span>
      </div>
      <div className="grid gap-28">{children}</div>
    </div>
  );
}
