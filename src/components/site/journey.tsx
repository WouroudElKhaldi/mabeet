import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { stagger } from "@/utils/motion";

export interface JourneyStop {
  icon: LucideIcon;
  title: string;
  body: string;
}

/**
 * The path of something from start to end, as stops on a dashed ticket line: in a row from `lg`, a column on phones.
 * The first time it scrolls into view the line draws itself and the stops rise in one after another.
 */
export function Journey({ stops }: { stops: JourneyStop[] }) {
  return (
    <Reveal className="relative">
      <span
        aria-hidden
        className="journey-line absolute inset-x-8 top-7 hidden border-t-2 border-dashed border-accent-line lg:block"
      />
      <span
        aria-hidden
        className="absolute start-7 top-8 bottom-8 border-s-2 border-dashed border-accent-line lg:hidden"
      />
      <ol className="relative grid gap-8 lg:grid-cols-4 lg:gap-6">
        {stops.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className="reveal-item flex gap-5 lg:block" style={stagger(index + 1)}>
            <span className="relative grid size-14 shrink-0 place-items-center rounded-full bg-surface text-accent shadow-soft ring-2 ring-accent">
              <Icon className="size-6" aria-hidden strokeWidth={1.7} />
              <span
                aria-hidden
                className="absolute -end-1 -top-1 grid size-6 place-items-center rounded-full bg-glow text-xs font-bold text-paper tabular-nums"
              >
                {index + 1}
              </span>
            </span>
            <div className="lg:mt-5">
              <p className="text-lg font-semibold">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
