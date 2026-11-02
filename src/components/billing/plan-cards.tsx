import clsx from "clsx";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CheckList } from "@/components/ui/check-list";
import { Pill } from "@/components/ui/pill";
import { PLAN_LIMITS, PLANS, type PlanName } from "@/config/plans";
import { formatMoney } from "@/utils/format";
import { stagger } from "@/utils/motion";

/**
 * The three host plans side by side, read from `PLAN_LIMITS`, so the prices and limits shown are the ones the
 * server enforces. `action` renders each card's button; `current` marks the plan in use.
 */
export async function PlanCards({
  current,
  action,
}: {
  current?: PlanName;
  action: (plan: PlanName) => ReactNode;
}) {
  const [t, locale] = await Promise.all([getTranslations("plans"), getLocale()]);
  const limit = (value: number | null) => (value === null ? t("unlimited") : String(value));

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {PLANS.map((plan, index) => {
        const limits = PLAN_LIMITS[plan];
        return (
          <li
            key={plan}
            className={clsx(
              "rise-in flex flex-col rounded-2xl bg-surface p-6",
              plan === "PRO" ? "shadow-lift ring-2 ring-accent" : "ring-1 ring-line",
            )}
            style={stagger(index + 1)}
          >
            <p className="flex items-center justify-between gap-2">
              <span className="text-lg font-semibold">{t(`names.${plan}`)}</span>
              {current === plan ? (
                <Pill tone="accent">{t("current")}</Pill>
              ) : (
                plan === "PRO" && <Pill>{t("popular")}</Pill>
              )}
            </p>
            <p className="mt-1 text-sm text-muted">{t(`blurbs.${plan}`)}</p>
            <p className="mt-5">
              <span className="font-poster text-4xl tabular-nums">
                {formatMoney(limits.monthlyUsd * 100, "USD", locale)}
              </span>
              <span className="text-sm text-muted"> {t("perMonth")}</span>
            </p>
            <CheckList
              className="mt-5 flex-1"
              missingLabel={t("notIncluded")}
              items={[
                { text: t("rooms", { count: limit(limits.rooms) }), included: true },
                { text: t("offerings", { count: limit(limits.offerings) }), included: true },
                { text: t("members", { count: limit(limits.members) }), included: true },
                { text: t("basics"), included: true },
                { text: t("ai"), included: limits.ai },
              ]}
            />
            <div className="mt-6">{action(plan)}</div>
          </li>
        );
      })}
    </ul>
  );
}
