import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlanCards } from "@/components/billing/plan-cards";
import { PageIntro, PageNote } from "@/components/site/page-intro";
import { ButtonLink } from "@/components/ui/button";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plans");
  return { title: t("title"), description: t("subtitle") };
}

/**
 * Public plans for hosts. A paid plan's button carries the plan to /host, which creates the workspace and goes
 * straight on to paying for it.
 */
export default async function PricingPage() {
  const t = await getTranslations("plans");
  return (
    <div className="mx-auto max-w-280 px-4 pt-12 pb-8 sm:px-6 lg:px-10">
      <PageIntro title={t("title")} intro={t("subtitle")} />
      <PlanCards
        action={(plan) => (
          <ButtonLink
            href={plan === "FREE" ? "/host" : `/host?plan=${plan}`}
            variant={plan === "PRO" ? "primary" : "secondary"}
            className={`w-full ${slideParent}`}
          >
            <SlideLabel icon={ArrowRight} flipInRtl>
              {plan === "FREE" ? t("startFree") : t("startWith", { plan: t(`names.${plan}`) })}
            </SlideLabel>
          </ButtonLink>
        )}
      />
      <PageNote>{t("noCommission")}</PageNote>
    </div>
  );
}
