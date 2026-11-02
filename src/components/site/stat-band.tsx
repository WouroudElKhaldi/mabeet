import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";
import { stagger } from "@/utils/motion";

/**
 * A dark band of striking figures (`BigStat`s, up to three in a row) under a big title, on faint postcard lines. The
 * first time it scrolls into view, the title, the figures and the small print rise in one after another; numbers in
 * a `CountUp` count themselves in.
 */
export function StatBand({
  title,
  intro,
  note,
  children,
}: {
  title: string;
  intro?: string;
  /** The small print under the figures: where they come from. */
  note?: string;
  children: ReactNode;
}) {
  return (
    <Reveal className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-paper sm:px-12 sm:py-16">
      <span aria-hidden className="ruled pointer-events-none absolute inset-0 opacity-[0.07]" />
      <div className="relative">
        <h2 className="reveal-item max-w-2xl font-poster text-[clamp(1.75rem,3.6vw,2.75rem)] leading-tight font-extrabold">
          {title}
        </h2>
        {intro ? (
          <p className="reveal-item mt-4 max-w-2xl text-lg leading-relaxed opacity-80" style={stagger(1)}>
            {intro}
          </p>
        ) : null}
        <div className="mt-12 grid gap-12 md:grid-cols-3">{children}</div>
        {note ? (
          <p className="reveal-item mt-12 text-xs opacity-60" style={stagger(5)}>
            {note}
          </p>
        ) : null}
      </div>
    </Reveal>
  );
}
