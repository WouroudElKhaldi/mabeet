import { clsx } from "clsx";
import type { ReactNode } from "react";

interface PassField {
  label: string;
  value: ReactNode;
}

interface BoardingPassProps {
  /** Small caps line at the top, e.g. "Booking request" or a status. */
  kicker: ReactNode;
  /** The destination, set large: a place name. */
  title: ReactNode;
  subtitle?: ReactNode;
  fields: PassField[];
  /** The stub under the tear line: reference, total, a call to action. */
  stub?: ReactNode;
  /** Colour behind the pass, so the tear-line bites match it. Defaults to the page colour. */
  biteColor?: string;
  className?: string;
}

/** Every booking is shown as a boarding pass: destination on top, the facts in a grid, a stub below the tear. */
export function BoardingPass({
  kicker,
  title,
  subtitle,
  fields,
  stub,
  biteColor,
  className,
}: BoardingPassProps) {
  return (
    <div
      className={clsx("overflow-hidden rounded-2xl bg-surface shadow-lift ring-1 ring-line", className)}
      style={biteColor ? ({ "--ticket-bite": biteColor } as React.CSSProperties) : undefined}
    >
      <div className="flex items-center justify-between gap-3 bg-accent px-5 py-3 text-accent-ink">
        <span className="text-xs font-bold tracking-[0.16em] uppercase">{kicker}</span>
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path
            d="M5 28V15a11 11 0 0 1 22 0v13"
            className="fill-none stroke-current"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M11 28v-8a5 5 0 0 1 10 0v8" className="fill-current" />
        </svg>
      </div>
      <div className="px-5 pt-4 pb-5">
        <p className="font-poster text-2xl">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-[0.6875rem] font-bold tracking-[0.12em] text-muted uppercase">
                {field.label}
              </dt>
              <dd className="mt-0.5 leading-snug font-semibold">{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {stub && <div className="ticket-tear mx-0 px-5 pt-4 pb-5">{stub}</div>}
    </div>
  );
}
