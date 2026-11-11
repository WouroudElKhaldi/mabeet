import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { listPlatformPeople } from "@/modules/accounts/server";
import { getPlanRevenue } from "@/modules/billing/server";
import { countPlatformBookings, listRefundsToSend } from "@/modules/bookings/server";
import { getSyncHealth } from "@/modules/calendar-sync/server";
import { listPayoutRequests } from "@/modules/payments/server";
import { listPlatformBusinesses } from "@/modules/workspaces/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate } from "@/utils/format";

/** How many of the newest businesses the overview lists. */
const NEWEST_SHOWN = 6;

/** The platform at a glance, and what needs the admin today. */
export default async function AdminOverviewPage() {
  const actor = await requirePageAdmin();
  const [t, locale, places, people, bookings, revenue, payouts, refunds, sync] = await Promise.all([
    getTranslations("admin"),
    getLocale(),
    listPlatformBusinesses(actor),
    listPlatformPeople(actor),
    countPlatformBookings(actor),
    getPlanRevenue(actor),
    listPayoutRequests(actor),
    listRefundsToSend(actor),
    getSyncHealth(actor),
  ]);
  const earned = revenue.thisMonth.find((row) => row.currency === "USD")?.cents ?? 0;
  const attention = [
    {
      href: "/admin/money/requests",
      label: t("attention.payouts", { count: payouts.total }),
      urgent: payouts.total > 0,
    },
    {
      href: "/admin/money/refunds",
      label: t("attention.refunds", { count: refunds.total }),
      urgent: refunds.total > 0,
    },
    {
      href: "/admin/health",
      label: t("attention.feeds", { count: sync.problems }),
      urgent: sync.problems > 0,
    },
  ];

  return (
    <>
      <PageHeader title={t("nav.overview")} intro={t("overviewIntro")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
        <section aria-label={t("title")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile kind="count" label={t("businesses")} value={places.total} />
          <StatTile kind="count" label={t("users")} value={people.total} />
          <StatTile
            kind="count"
            label={t("bookings30")}
            value={bookings.recent}
            note={t("allTime", { count: bookings.total })}
          />
          <StatTile kind="money" currency="USD" label={t("money.earnedMonth")} value={earned} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t("attention.title")}>
            <ul className="grid gap-2">
              {attention.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm ring-1 ring-line transition-colors hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={clsx(
                          "size-2.5 shrink-0 rounded-full",
                          item.urgent ? "bg-danger" : "bg-success",
                        )}
                      />
                      {item.label}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel
            title={t("newestBusinesses")}
            action={
              <Link href="/admin/hosts" className="text-sm font-semibold text-accent hover:underline">
                {t("seeAll")}
              </Link>
            }
          >
            <ul className="divide-y divide-line">
              {places.businesses.slice(0, NEWEST_SHOWN).map((business) => (
                <li key={business.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <bdi className="truncate font-semibold">{business.name}</bdi>
                  <span className="shrink-0 text-muted">
                    {formatDate(toIsoDate(business.createdAt), locale)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
