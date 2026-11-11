import { getLocale, getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/shell/page-header";
import { BarChart, ShareBar } from "@/components/ui/bar-chart";
import { panelClass } from "@/components/ui/field";
import { StatTile } from "@/components/ui/stat-tile";
import { channelColor } from "@/modules/analytics";
import { getBusinessReport, getSavings } from "@/modules/analytics/server";
import { BookingRow } from "@/modules/bookings";
import { listBookings } from "@/modules/bookings/server";
import { SetupChecklist } from "@/modules/rooms";
import { getSetupChecklist } from "@/modules/rooms/server";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { addDays, todayUtc } from "@/utils/dates";
import { stagger } from "@/utils/motion";

type PageProps = { params: Promise<{ businessId: string }> };

/** The numbers look back this many days, today included. */
const REPORT_DAYS = 90;
/** The most requests listed here; the bookings page has the rest. */
const REQUESTS_SHOWN = 20;

/**
 * The place's home: its key numbers over the last 90 days, what booking direct saved it since it joined, the requests
 * waiting for an answer, then nights by month and where they came from. Each part shows only to members whose role
 * reads it.
 */
export default async function TodayPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.overview.anyOf);
  const now = new Date();
  const today = todayUtc(now);
  const period = { checkIn: addDays(today, 1 - REPORT_DAYS), checkOut: addDays(today, 1) };
  const readsNumbers = can(ctx, "analytics.read");
  const readsBookings = can(ctx, "bookings.read");
  const [t, locale, report, savings, waiting, setup] = await Promise.all([
    getTranslations("dashboard.overview"),
    getLocale(),
    readsNumbers ? getBusinessReport(ctx, period) : null,
    readsNumbers ? getSavings(ctx) : null,
    readsBookings ? listBookings(ctx, { status: "HELD", take: REQUESTS_SHOWN, skip: 0 }) : [],
    // Until the place is listed, the people who run it see what is left to do first.
    can(ctx, "settings.manage") ? getSetupChecklist(ctx) : null,
  ]);
  const monthName = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });

  return (
    <>
      <PageHeader title={t("title")} intro={t("subtitle")} />
      <div className="grid gap-10">
        {setup && !setup.listed ? (
          <SetupChecklist
            businessId={businessId}
            steps={setup.steps}
            photoCount={setup.photoCount}
            bookingUnit={setup.bookingUnit}
            ready={setup.ready}
          />
        ) : null}
        {report ? (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("kpis")}>
            <div className="rise-in h-full" style={stagger(1)}>
              <StatTile
                label={t("occupancy")}
                value={report.occupancyRate}
                kind="percent"
                note={t("last90")}
              />
            </div>
            <div className="rise-in h-full" style={stagger(2)}>
              <StatTile
                label={t("directRevenue")}
                value={report.directRevenueCents}
                kind="money"
                currency={report.currency}
              />
            </div>
            <div className="rise-in h-full" style={stagger(3)}>
              <StatTile
                label={t("commissionSaved")}
                value={report.commissionSavedCents}
                kind="money"
                currency={report.currency}
                note={t("vsPlatforms")}
              />
            </div>
            <div className="rise-in h-full" style={stagger(4)}>
              <StatTile label={t("nightsSold")} value={report.nightsSold} kind="count" />
            </div>
          </section>
        ) : null}

        {savings?.savings.map((row) => {
          const fees = savings.planFees.find((fee) => fee.currency === row.currency)?.cents ?? 0;
          return (
            <section key={row.currency} className={panelClass}>
              <h2 className="text-2xl font-semibold">{t("savings.title")}</h2>
              <p className="mt-1 text-sm text-muted">{t("savings.intro")}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                  label={t("savings.revenue")}
                  value={row.directRevenueCents}
                  kind="money"
                  currency={row.currency}
                />
                <StatTile
                  label={t("savings.saved")}
                  value={row.commissionSavedCents}
                  kind="money"
                  currency={row.currency}
                  note={t("vsPlatforms")}
                />
                <StatTile label={t("savings.fees")} value={fees} kind="money" currency={row.currency} />
                <StatTile
                  label={t("savings.kept")}
                  value={row.commissionSavedCents - fees}
                  kind="money"
                  currency={row.currency}
                  note={t("savings.keptNote")}
                />
              </div>
            </section>
          );
        })}

        {readsBookings ? (
          <section>
            <h2 className="text-2xl font-semibold">{t("requests", { count: waiting.length })}</h2>
            {waiting.length === 0 ? (
              <p className="mt-4 rounded-xl bg-surface p-6 text-muted ring-1 ring-line">{t("noRequests")}</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {waiting.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    businessId={businessId}
                    canDecide={can(ctx, "bookings.decide")}
                    now={now}
                  />
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {report ? (
          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className={panelClass}>
              <h2 className="font-display text-xl font-semibold">{t("nightsByMonth")}</h2>
              <div className="mt-6">
                {report.monthly.length === 0 ? (
                  <p className="text-sm text-muted">{t("noNightsYet")}</p>
                ) : (
                  <BarChart
                    bars={report.monthly.map((month) => {
                      const label = monthName.format(new Date(`${month.month}-01T00:00:00Z`));
                      return {
                        label,
                        value: month.nights,
                        title: t("nightsTitle", { month: label, count: month.nights }),
                      };
                    })}
                  />
                )}
              </div>
            </div>
            <div className={panelClass}>
              <h2 className="font-display text-xl font-semibold">{t("channels")}</h2>
              <p className="mt-1 text-sm text-muted">{t("channelsHint")}</p>
              <div className="mt-6">
                {report.channels.length === 0 ? (
                  <p className="text-sm text-muted">{t("noNightsYet")}</p>
                ) : (
                  <ShareBar
                    shares={report.channels.map((channel) => ({
                      label: t(`channel.${channel.channel}`),
                      value: channel.nights,
                      className: channelColor(channel.channel),
                    }))}
                  />
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
