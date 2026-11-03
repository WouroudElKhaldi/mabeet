import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";
import { stagger } from "@/utils/motion";

/**
 * One chapter on a `StoryRail`: its stop on the line (its icon in a ring that fills with the accent and pops when the
 * chapter scrolls into view), a small "Chapter 01" kicker in the glow colour, then the chapter itself rising in.
 */
export function StoryChapter({
  number,
  kicker,
  icon: Icon,
  children,
}: {
  number: number;
  /** A word or two for what the chapter is about: "The problem". */
  kicker: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Reveal className="relative">
      <span
        aria-hidden
        className="story-stop absolute -start-8 top-0 grid size-8 -translate-x-1/2 place-items-center rounded-full bg-surface text-muted ring-2 ring-line-strong sm:-start-12 rtl:translate-x-1/2"
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <p className="reveal-item mb-5 flex items-center gap-3 text-[0.6875rem] font-bold tracking-[0.16em] text-glow uppercase">
        <span className="tabular-nums">{String(number).padStart(2, "0")}</span>
        <span aria-hidden className="h-px w-8 bg-glow" />
        {kicker}
      </p>
      <div className="reveal-item" style={stagger(1)}>
        {children}
      </div>
    </Reveal>
  );
}
