import { getLocale, getTranslations } from "next-intl/server";
import { ScrollRail } from "@/components/ui/scroll-rail";
import { categoryName } from "@/config/appearance";
import { listCategories } from "@/modules/admin/server";
import type { NearbyOffering } from "../types";
import { OfferingCard } from "./offering-card";

/**
 * The experiences and services a guest could join during their stay, in a row that scrolls sideways inside itself on
 * a phone, sponsored ones first and marked so. The page leaves it out when there are none.
 */
export async function NearbyOfferings({ offerings }: { offerings: NearbyOffering[] }) {
  const [t, locale, experiences, services] = await Promise.all([
    getTranslations("partners.nearby"),
    getLocale(),
    listCategories("EXPERIENCE"),
    listCategories("SERVICE"),
  ]);
  const categories = new Map([...experiences, ...services].map((category) => [category.slug, category]));
  return (
    <ScrollRail label={t("experiences")} labels={{ previous: t("previous"), next: t("next") }}>
      {offerings.map((offering) => {
        const category = offering.categorySlug ? categories.get(offering.categorySlug) : undefined;
        return (
          <div key={offering.slug} className="w-60 shrink-0">
            <OfferingCard
              offering={offering}
              categoryLabel={category ? categoryName(category, locale) : undefined}
              sponsored={offering.sponsored}
            />
          </div>
        );
      })}
    </ScrollRail>
  );
}
