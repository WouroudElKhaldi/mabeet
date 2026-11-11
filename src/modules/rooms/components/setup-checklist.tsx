"use client";

import clsx from "clsx";
import { Check, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Panel } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { SETUP_PHOTOS, SETUP_SCREEN_OF_STEP, type SetupStep } from "@/config/setup";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/**
 * Getting a new place ready, on its home page until it is listed: each step says what it needs and leads to its
 * screen of the guided setup, and ticks itself once it is saved, there or on the place's own pages. Publishing is the
 * last step, here in one click once the others are done. The guided setup ends on this same list (`inSetup`), without
 * the button that leads into it.
 */
export function SetupChecklist({
  businessId,
  steps,
  photoCount,
  ready,
  inSetup = false,
}: {
  businessId: string;
  steps: Array<{ key: SetupStep; done: boolean }>;
  photoCount: number;
  ready: boolean;
  inSetup?: boolean;
}) {
  const t = useTranslations("setup");
  const { run, pending, error } = useAction();
  const setup = `/dashboard/${businessId}/setup`;
  const doneCount = steps.filter((step) => step.done).length;

  const publish = () =>
    void run(() => api.patch(`/api/workspaces/${businessId}/settings`, { listedPublicly: true }));

  return (
    <Panel
      title={t("title")}
      intro={t("intro", { done: doneCount, total: steps.length })}
      action={
        inSetup ? null : (
          <ButtonLink href={setup} size="sm">
            <Sparkles className="size-4" aria-hidden />
            {t("flow.start")}
          </ButtonLink>
        )
      }
    >
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
              <ArrowLink href={`${setup}?step=${SETUP_SCREEN_OF_STEP[step.key]}`}>{t("go")}</ArrowLink>
            )}
          </li>
        ))}
      </ol>
      {!ready ? <p className="mt-3 text-sm text-muted">{t("publishLater")}</p> : null}
      <FormError message={error} className="mt-3" />
    </Panel>
  );
}
