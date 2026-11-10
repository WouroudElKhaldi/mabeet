import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/config/appearance";
import { PageHeader } from "@/components/shell/page-header";
import { PartnerManager } from "@/modules/partners";
import { listPartnersForAdmin } from "@/modules/partners/server";
import { requirePageAdmin } from "@/server/http/session";
import { addDays, parseIsoDate, todayUtc, toIsoDate } from "@/utils/dates";
import { formatStayDates } from "@/utils/format";

/** The partner places near our guesthouses, and the days each is sponsored. */
export default async function AdminPartnersPage() {
  const actor = await requirePageAdmin();
  const now = new Date();
  const [t, locale, partners] = await Promise.all([
    getTranslations("admin.partners"),
    getLocale(),
    listPartnersForAdmin(actor, now),
  ]);
  return (
    <>
      <PageHeader title={t("title")} intro={t("hint")} />
      <PartnerManager
        partners={partners.map((partner) => ({
          ...partner,
          sponsorships: partner.sponsorships.map((sponsorship) => ({
            ...sponsorship,
            // The last day sponsored, not the day it ends.
            label: formatStayDates(
              parseIsoDate(sponsorship.startsOn),
              addDays(parseIsoDate(sponsorship.endsOn), -1),
              locale as Locale,
            ),
          })),
        }))}
        today={toIsoDate(todayUtc(now))}
      />
    </>
  );
}
