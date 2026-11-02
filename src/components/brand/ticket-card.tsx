import clsx from "clsx";
import { useId } from "react";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/site/wordmark";

/**
 * A public page's one form, dressed as a ticket like `BoardingPass`: the title in the accent band with the arch mark,
 * an intro, the `stub` (what the visitor is getting, such as the chosen plan), the tear line, then the form.
 * `sticky` keeps it in view beside a long column from `lg` up.
 */
export function TicketCard({
  title,
  intro,
  header,
  stub,
  sticky = false,
  children,
}: {
  title: string;
  intro?: string;
  /** Under the intro, before the stub: the steps ahead, for example. */
  header?: ReactNode;
  stub?: ReactNode;
  sticky?: boolean;
  /** Under the tear line: the form or the actions. Without it, the ticket ends after the stub. */
  children?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={clsx(
        "h-fit overflow-hidden rounded-2xl bg-surface shadow-lift ring-1 ring-line",
        sticky && "lg:sticky lg:top-24",
      )}
    >
      <div className="flex items-center justify-between gap-3 bg-accent px-6 py-3 text-accent-ink sm:px-8">
        <h2 id={titleId} className="text-xs font-bold tracking-[0.16em] uppercase">
          {title}
        </h2>
        <LogoMark className="h-6 w-[1.37rem]" />
      </div>
      <div className="px-6 pt-5 pb-6 sm:px-8">
        {intro ? <p className="text-sm text-muted">{intro}</p> : null}
        {header ? <div className="mt-4">{header}</div> : null}
        {stub ? <div className="mt-5">{stub}</div> : null}
      </div>
      {children ? (
        <div className="ticket-tear px-6 pt-6 pb-7 [--ticket-bite:var(--paper)] sm:px-8">{children}</div>
      ) : null}
    </section>
  );
}
