import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { Sheen } from "@/components/brand/brand-scene";
import { TiltCard } from "@/components/brand/tilt-card";

/**
 * One topic of a reading page as a card that leans toward the mouse (`TiltCard`): its number, its icon floating in
 * an accent tile, a title and a short answer, with the icon drawn large and faint behind. On hover a glow bar grows
 * along the top and the tile fills with the accent. `highlight` rings it in the accent, for the one topic a reader
 * must not miss.
 */
export function TopicCard({
  icon: Icon,
  number,
  title,
  body,
  highlight = false,
  style,
}: {
  icon: LucideIcon;
  /** Its place in the list, shown as "01", "02"... */
  number: number;
  title: string;
  body: string;
  highlight?: boolean;
  /** For its place in a `rise-in` sequence (`stagger`). */
  style?: CSSProperties;
}) {
  return (
    <div className="rise-in h-full" style={style}>
      <TiltCard
        className={clsx(
          "group/topic flex flex-col rounded-2xl bg-surface p-6 transition-shadow duration-300 hover:shadow-lift",
          highlight ? "shadow-soft ring-2 ring-accent" : "ring-1 ring-line hover:ring-accent-line",
        )}
      >
        {/* Clipping the card itself would flatten its 3D, so only this flat layer behind the content clips. */}
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <span
            className={clsx(
              "absolute inset-x-0 top-0 h-1 origin-left bg-glow transition-[scale] duration-500 ease-(--ease-spring) rtl:origin-right",
              highlight ? "scale-x-100" : "scale-x-0 group-hover/topic:scale-x-100",
            )}
          />
          <Icon
            strokeWidth={1}
            className="absolute -end-6 -bottom-6 size-36 -rotate-12 text-accent opacity-[0.06] transition-[rotate,scale] duration-700 ease-(--ease-spring) group-hover/topic:scale-110 group-hover/topic:rotate-0"
          />
        </span>
        <div className="flex [transform:translateZ(40px)] items-start justify-between gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-accent-line transition-colors duration-300 group-hover/topic:bg-accent group-hover/topic:text-accent-ink">
            <Icon
              className="size-5 transition-[rotate] duration-500 ease-(--ease-spring) group-hover/topic:-rotate-12"
              aria-hidden
              strokeWidth={1.8}
            />
          </span>
          <span aria-hidden className="font-display text-2xl font-bold text-faint tabular-nums">
            {String(number).padStart(2, "0")}
          </span>
        </div>
        <h3 className="mt-5 [transform:translateZ(24px)] text-lg font-semibold">{title}</h3>
        <p className="mt-2 [transform:translateZ(12px)] text-sm leading-relaxed text-muted">{body}</p>
        <Sheen />
      </TiltCard>
    </div>
  );
}
