import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { PartnerManager } from "@/modules/partners";
import { listPartnersForAdmin } from "@/modules/partners/server";
import { requirePageAdmin } from "@/server/http/session";
import { todayUtc, toIsoDate } from "@/utils/dates";

/** The partner places near our guesthouses, and the days each is sponsored. */
export default async function AdminPartnersPage() {
  const actor = await requirePageAdmin();
  const now = new Date();
  const [t, partners] = await Promise.all([
    getTranslations("admin.partners"),
    listPartnersForAdmin(actor, now),
  ]);
  return (
    <>
      <PageHeader title={t("title")} intro={t("hint")} />
      <PartnerManager partners={partners} today={toIsoDate(todayUtc(now))} />
    </>
  );
}
