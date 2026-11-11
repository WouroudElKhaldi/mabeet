"use client";

import type { BookingUnit } from "@prisma/client";
import clsx from "clsx";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Panel } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { SETUP_PHOTOS, type SetupStep } from "@/config/setup";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/** Where each step is done. Rooms are their own page, unless the place is booked as a whole. */
function stepPath(step: SetupStep, bookingUnit: BookingUnit): string {
  if (step === "describe" || step === "photos") return step === "photos" ? "/place#photos" : "/place";
  if (step === "rooms") return bookingUnit === "WHOLE_PLACE" ? "/place" : "/rooms";
  return "/settings";
}

/**
 * Getting a new place ready, on its home page until it is listed: each step says what it needs and leads to the page
 * where it is done, and ticks itself once it is saved there. Publishing is the last step, here in one click once the
 * others are done.
 */
export function SetupChecklist({
  businessId,
  steps,
  photoCount,
  bookingUnit,
  ready,
}: {
  businessId: string;
  steps: Array<{ key: SetupStep; done: boolean }>;
  photoCount: number;
  bookingUnit: BookingUnit;
  ready: boolean;
}) {
  const t = useTranslations("setup");
  const { run, pending, error } = useAction();
  const base = `/dashboard/${businessId}`;
  const doneCount = steps.filter((step) => step.done).length;

  const publish = () =>
    void run(() => api.patch(`/api/workspaces/${businessId}/settings`, { listedPublicly: true }));

  return (
    <Panel title={t("title")} intro={t("intro", { done: doneCount, total: steps.length })}>
      <div
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
        className="mb-5 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <ol className="grid gap-2">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={clsx(
              "flex flex-col gap-3 rounded-xl p-4 ring-1 ring-line sm:flex-row sm:items-center",
              step.done && "bg-surface-2",
            )}
          >
            <span
              aria-hidden
              className={clsx(
                "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
                step.done ? "bg-accent text-accent-ink" : "ring-1 ring-line-strong",
              )}
            >
              {step.done ? <Check className="size-4" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={clsx("font-semibold", step.done && "text-muted")}>
                {t(`steps.${step.key}.title`)}
                {step.done ? <span className="sr-only"> ({t("done")})</span> : null}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {step.key === "photos"
                  ? t("steps.photos.body", { count: photoCount, needed: SETUP_PHOTOS })
                  : t(`steps.${step.key}.body`)}
              </p>
            </div>
            {step.key === "publish" ? (
              step.done ? null : (
                <Button size="sm" disabled={!ready || pending} onClick={publish}>
                  {t("publish")}
                </Button>
              )
            ) : step.done ? null : (
              <ArrowLink href={`${base}${stepPath(step.key, bookingUnit)}`}>{t("go")}</ArrowLink>
            )}
          </li>
        ))}
      </ol>
      {!ready ? <p className="mt-3 text-sm text-muted">{t("publishLater")}</p> : null}
      <FormError message={error} className="mt-3" />
    </Panel>
  );
}
