import { stagger } from "@/utils/motion";

interface Bar {
  label: string;
  value: number;
  /** What the bar says, for hover and screen readers: "Oct 2026: 42 nights". */
  title: string;
}

/** Plain bars in the theme's colours; each value is shown on hover and read out to screen readers. */
export function BarChart({ bars, height = 160 }: { bars: Bar[]; height?: number }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <ul className="flex items-end gap-2" style={{ height }}>
      {bars.map((bar, index) => (
        <li
          key={bar.label}
          className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
          title={bar.title}
        >
          <span className="sr-only">{bar.title}</span>
          <div
            aria-hidden
            className="rise-in w-full origin-bottom rounded-t-sm bg-accent/80 transition-colors group-hover:bg-accent"
            style={{ ...stagger(index), height: `${Math.max(2, (bar.value / max) * 100)}%` }}
          />
          <span aria-hidden className="truncate text-center text-xs text-muted">
            {bar.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface Share {
  label: string;
  value: number;
  /** Its colour, as a token class: "bg-accent". */
  className: string;
}

/** One stacked bar showing the parts of a whole, with a legend of their shares. */
export function ShareBar({ shares }: { shares: Share[] }) {
  const total = shares.reduce((sum, share) => sum + share.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        {shares.map((share) => (
          <div
            key={share.label}
            className={`${share.className} h-full transition-[width] duration-700 ease-out`}
            style={{ width: `${(share.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {shares.map((share) => (
          <li key={share.label} className="flex items-center gap-2">
            <span className={`${share.className} size-2.5 rounded-full`} aria-hidden />
            <span className="text-muted">{share.label}</span>
            <span className="font-semibold tabular-nums">{Math.round((share.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
