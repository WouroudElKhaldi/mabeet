"use client";

import { animate, useReducedMotion } from "motion/react";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useInView } from "@/hooks/use-in-view";
import { formatMoney } from "@/utils/format";

const FORMATS = {
  /** A whole number: 20. */
  number: (value: number) => String(Math.round(value)),
  /** A percentage given as a whole number: 15 shows "15%". */
  percent: (value: number) => `${Math.round(value)}%`,
} as const;

/**
 * A number that counts up to `to` the first time it scrolls into view. The page is sent with the final number, so
 * it reads right without JavaScript and to search engines; reduced motion shows it at once. `usdCents` counts money
 * in cents and shows it like every other price ("$14.40"), or as whole dollars when it ends round ("$288").
 */
export function CountUp({
  to,
  format = "number",
}: {
  to: number;
  format?: keyof typeof FORMATS | "usdCents";
}) {
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const [ref, inView] = useInView<HTMLSpanElement>(0.6);
  const [value, setValue] = useState(to);

  // `inView` only ever turns true once, so the count plays once (React's development double run simply restarts it).
  useEffect(() => {
    if (reduceMotion) return;
    // Until it is scrolled to, it waits at zero, so the count is what the visitor sees arrive.
    if (!inView) {
      setValue(0);
      return;
    }
    const controls = animate(0, to, { duration: 1.6, ease: [0.2, 0, 0, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView, reduceMotion, to]);

  // A round final amount is shown without cents all the way up, so the figure does not change width as it counts.
  const shown =
    format === "usdCents"
      ? formatMoney(Math.round(value), "USD", locale, { wholeUnits: to % 100 === 0 })
      : FORMATS[format](value);
  return (
    <span ref={ref} className="tabular-nums">
      {shown}
    </span>
  );
}
