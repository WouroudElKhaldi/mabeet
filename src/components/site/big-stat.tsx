import type { CSSProperties, ReactNode } from "react";

/**
 * One striking number with what it means, set large in the poster font with a glow bar under it: for a band of
 * figures on a public page. Put a `CountUp` in `value` to count it in. Inside a `Reveal`, it rises in at its
 * `--stagger`.
 */
export function BigStat({ value, label, style }: { value: ReactNode; label: string; style?: CSSProperties }) {
  return (
    <div className="reveal-item min-w-0" style={style}>
      <p className="font-poster text-[clamp(2.5rem,6vw,4.25rem)] leading-none font-extrabold whitespace-nowrap">
        {value}
      </p>
      <span aria-hidden className="mt-4 block h-1 w-12 rounded-full bg-glow" />
      <p className="mt-4 max-w-xs leading-relaxed opacity-80">{label}</p>
    </div>
  );
}
