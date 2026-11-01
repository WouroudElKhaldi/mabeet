import { useId } from "react";
import type { ReactNode } from "react";
import { panelClass } from "@/components/ui/field";

/** The title block of a dashboard or admin page: a small bar, the title, an intro, and actions on the end side. */
export function PageHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="rise-in mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <span aria-hidden className="mb-3 block h-1 w-10 rounded-full bg-glow" />
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {intro ? <p className="mt-2 max-w-2xl text-muted">{intro}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

/** A titled card on a dashboard page. */
export function Panel({
  title,
  intro,
  action,
  children,
}: {
  title: string;
  intro?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={panelClass}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          {intro ? <p className="mt-1 text-sm text-muted">{intro}</p> : null}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
