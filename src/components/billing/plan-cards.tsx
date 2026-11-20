import clsx from "clsx";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CheckList } from "@/components/ui/check-list";
import { Pill } from "@/components/ui/pill";
import { allowanceOf, PLAN_LIMITS, PLANS, type PlanName } from "@/config/plans";
import { formatMoney } from "@/utils/format";
import { OFFERINGS_SHOWN } from "@/config/listing";
import { stagger } from "@/utils/motion";

/**
 * The five host plans side by side, read from `PLAN_LIMITS`, so the prices and limits shown are the ones the
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

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                { text: t("rooms", allowanceOf(limits.rooms)), included: true },
                ...(OFFERINGS_SHOWN
                  ? [{ text: t("offerings", allowanceOf(limits.offerings)), included: true }]
                  : []),
                { text: t("members", allowanceOf(limits.members)), included: true },
                { text: t("basics"), included: true },
                { text: t("setupHelp"), included: true },
                { text: t("analytics"), included: limits.analytics },
                { text: t("mcp"), included: limits.mcp },
                { text: t("prioritySupport"), included: limits.prioritySupport },
                { text: t(`featured.${limits.featured ?? "none"}`), included: limits.featured !== null },
              ]}
            />
            <div className="mt-6">{action(plan)}</div>
          </li>
        );
      })}
    </ul>
  );
}
