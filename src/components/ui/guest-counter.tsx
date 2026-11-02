"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId } from "react";
import { clampGuests } from "@/utils/guest-count";
import { Button } from "./button";

interface GuestCounterProps {
  value: number;
  onChange: (guests: number) => void;
  /** The fewest guests (one by default). */
  min?: number;
  /** The most guests: the room's capacity. */
  max: number;
  /** A short help text under the label, such as "Including children". */
  hint?: string;
}

/** How many guests: a number between two buttons, never below `min` or above `max`. */
export function GuestCounter({ value, onChange, min = 1, max, hint }: GuestCounterProps) {
  const t = useTranslations("search");
  const labelId = useId();
  const current = clampGuests(value, min, Math.max(max, min));
  const atMin = current <= min;
  const atMax = current >= max;

  // A value that does not fit (the room changed to one with fewer beds) is shown as the nearest one that does, and
  // the screen is told, so what the guest sees is what is sent. It fires once: the new value fits.
  useEffect(() => {
    if (current !== value) onChange(current);
  }, [current, value, onChange]);

  // The buttons stay in the page when they reach a limit (`aria-disabled`, not `disabled`): a disabled button throws
  // the keyboard focus away, and a person holding Enter on "+" would lose their place.
  return (
    <div role="group" aria-labelledby={labelId} className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <span id={labelId} className="text-sm font-semibold text-ink">
          {t("guestsLabel")}
        </span>
        {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Button
          variant="secondary"
          size="icon"
          aria-label={t("guestsDecrease")}
          aria-disabled={atMin}
          onClick={() => !atMin && onChange(current - 1)}
        >
          <Minus className="size-4" aria-hidden />
        </Button>
        <output aria-live="polite" className="min-w-8 text-center text-lg font-semibold tabular-nums">
          <span aria-hidden>{current}</span>
          <span className="sr-only">{t("guests", { count: current })}</span>
        </output>
        <Button
          variant="secondary"
          size="icon"
          aria-label={t("guestsIncrease")}
          aria-disabled={atMax}
          onClick={() => !atMax && onChange(current + 1)}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
