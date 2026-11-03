import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A dashboard card that opens to show what is inside: one room to edit among many. The title and a short status sit
 * in its always-visible bar. It is the browser's own <details>, so it opens with the keyboard and without JavaScript.
 */
export function DisclosurePanel({
  title,
  status,
  defaultOpen = false,
  children,
}: {
  title: string;
  status?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl bg-surface ring-1 ring-line open:shadow-soft">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-5 focus-visible:ring-2 focus-visible:ring-ink">
        <span className="min-w-0 truncate font-display text-xl font-semibold">{title}</span>
        <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
          {status}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="border-t border-line p-5">{children}</div>
    </details>
  );
}
