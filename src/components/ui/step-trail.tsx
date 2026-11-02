import clsx from "clsx";

/** The steps of a short process in one line, numbered; the one the visitor is on is filled with the accent. */
export function StepTrail({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold">
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? "step" : undefined}
          className={clsx("flex items-center gap-1.5", index === current ? "text-ink" : "text-muted")}
        >
          <span
            aria-hidden
            className={clsx(
              "grid size-5 place-items-center rounded-full tabular-nums",
              index === current ? "bg-accent text-accent-ink" : "ring-1 ring-line-strong",
            )}
          >
            {index + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}
