import clsx from "clsx";
import type { ReactNode } from "react";

const toneClasses = {
  accent: "bg-accent text-accent-ink",
  quiet: "bg-surface-2 text-ink",
} as const;

/** A small rounded label beside a title: "Your plan", "Most popular". `accent` marks what is chosen. */
export function Pill({ tone = "quiet", children }: { tone?: keyof typeof toneClasses; children: ReactNode }) {
  return (
    <span className={clsx("rounded-full px-2.5 py-1 text-xs font-bold", toneClasses[tone])}>{children}</span>
  );
}
