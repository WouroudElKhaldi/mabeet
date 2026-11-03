"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/config/appearance";
import { formatMoney } from "@/utils/format";

type StatKind = { kind: "money"; currency: string } | { kind: "percent" } | { kind: "count" };

type StatTileProps = StatKind & { label: string; value: number; note?: string };

function format(value: number, stat: StatKind, locale: Locale): string {
  switch (stat.kind) {
    case "money":
      return formatMoney(Math.round(value), stat.currency, locale);
    case "percent":
      return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value);
    case "count":
      return new Intl.NumberFormat(locale).format(Math.round(value));
  }
}

/**
 * A headline number that counts up the first time it scrolls into view: money in its currency, a share (0 to 1) as
 * a percentage, or a count. Reduced motion shows it at once.
 */
export function StatTile({ label, value, note, ...stat }: StatTileProps) {
  const locale = useLocale() as Locale;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setShown(value);
      return;
    }
    const controls = animate(0, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    return () => controls.stop();
  }, [inView, reduced, value]);

  return (
    <div
      ref={ref}
      className="relative flex h-full flex-col overflow-hidden rounded-xl bg-surface p-5 ring-1 ring-line"
    >
      <span className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-accent to-glow" aria-hidden />
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{format(shown, stat, locale)}</p>
      {note && <p className="mt-auto pt-1 text-sm text-muted">{note}</p>}
    </div>
  );
}
