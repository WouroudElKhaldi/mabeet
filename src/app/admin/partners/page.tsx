import { getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { FeaturedPlaces, PartnerManager } from "@/modules/partners";
import { listFeaturedPlacesForAdmin, listPartnersForAdmin } from "@/modules/partners/server";
import { listPlatformBusinesses } from "@/modules/workspaces/server";
import { requirePageAdmin } from "@/server/http/session";
import { todayUtc, toIsoDate } from "@/utils/dates";

/** The guesthouses featured in search, then the partner places near our guesthouses and the days each is sponsored. */
export default async function AdminPartnersPage() {
  const actor = await requirePageAdmin();
  const now = new Date();
  const [t, partners, featured, platform] = await Promise.all([
    getTranslations("admin.partners"),
    listPartnersForAdmin(actor, now),
    listFeaturedPlacesForAdmin(actor, now),
    listPlatformBusinesses(actor),
  ]);
  const openPlaces = platform.businesses
    .filter((business) => business.status === "ACTIVE")
    .map(({ id, name }) => ({ id, name }))
    .sort((first, second) => first.name.localeCompare(second.name));
  return (
    <>
      <PageHeader title={t("title")} intro={t("hint")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
        <Panel title={t("featuredTitle")} intro={t("featuredHint")}>
          <FeaturedPlaces featured={featured} places={openPlaces} />
        </Panel>
        <PartnerManager partners={partners} today={toIsoDate(todayUtc(now))} />
      </div>
    </>
  );
}
