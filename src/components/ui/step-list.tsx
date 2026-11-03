/** How to do something, as numbered steps under a small title: one short sentence each. */
export function StepList({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div>
      <p className="mb-3 font-semibold">{title}</p>
      <ol className="grid gap-2.5 text-sm">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span
              aria-hidden
              className="grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums ring-1 ring-line-strong"
            >
              {index + 1}
            </span>
            <span className="text-muted">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
