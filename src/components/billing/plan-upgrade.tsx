import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { type PlanFeature, smallestPlanWith } from "@/config/plans";

/**
 * What a dashboard page shows instead of its content when the place's plan doesn't include it: what the feature is,
 * the smallest plan that has it, and the way to the billing page.
 */
export async function PlanUpgrade({ businessId, feature }: { businessId: string; feature: PlanFeature }) {
  const t = await getTranslations("plans");
  const plan = t(`names.${smallestPlanWith(feature)}`);
  return (
    <Panel title={t("upgrade.title", { plan })} intro={t(`upgrade.${feature}`)}>
      <ButtonLink href={`/dashboard/${businessId}/billing`}>{t("upgrade.seePlans")}</ButtonLink>
    </Panel>
  );
}
