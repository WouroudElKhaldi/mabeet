import { getLocale, getTranslations } from "next-intl/server";
import { ChoiceLinks } from "@/components/ui/choice-links";
import { allowanceOf, PLAN_LIMITS, PLANS, type PlanName } from "@/config/plans";
import { formatMoney } from "@/utils/format";

/**
 * The plan to start on, picked in place: each plan as a chip, each its own address (`hrefFor`), and under
 * them what the chosen plan costs and allows, read from `PLAN_LIMITS` like `PlanCards`.
 */
export async function PlanPicker({
  current,
  hrefFor,
}: {
  current: PlanName;
  hrefFor: (plan: PlanName) => string;
}) {
  const [t, locale] = await Promise.all([getTranslations("plans"), getLocale()]);
  const limits = PLAN_LIMITS[current];
  const price = (plan: PlanName) => formatMoney(PLAN_LIMITS[plan].monthlyUsd * 100, "USD", locale);
  const facts = [
    `${price(current)} ${t("perMonth")}`,
    t("rooms", allowanceOf(limits.rooms)),
    t("members", allowanceOf(limits.members)),
    ...(limits.analytics ? [t("analytics")] : []),
    ...(limits.mcp ? [t("mcp")] : []),
  ];

  return (
    <div>
      <p className="mb-2 text-[0.6875rem] font-bold tracking-[0.12em] text-muted uppercase">{t("current")}</p>
      <ChoiceLinks
        label={t("current")}
        choices={PLANS.map((plan) => ({
          href: hrefFor(plan),
          label: t(`names.${plan}`),
          detail: price(plan),
          current: plan === current,
        }))}
      />
      <p className="mt-3 text-sm text-muted">{facts.join(" · ")}</p>
    </div>
  );
}
