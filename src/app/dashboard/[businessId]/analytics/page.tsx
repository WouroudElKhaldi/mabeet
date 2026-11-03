import { clsx } from "clsx";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { BarChart, ShareBar } from "@/components/ui/bar-chart";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { StatTile } from "@/components/ui/stat-tile";
import type { Locale } from "@/config/appearance";
import { BOOKING_STATUSES } from "@/config/enums";
import { analyticsQuery, channelColor } from "@/modules/analytics";
import { getAnalytics } from "@/modules/analytics/server";
import { requirePageAccess } from "@/server/http/session";
import { addDays, toIsoDate, todayUtc } from "@/utils/dates";
import { formatMoney } from "@/utils/format";

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ from?: string; to?: string; scope?: string }>;
};

/** Quick periods, in days ending today. */
const PRESETS = [30, 90, 365] as const;
const SCOPES = ["place", "all"] as const;

/** Each request outcome's colour on the requests bar. */
const STATUS_COLOR: Record<(typeof BOOKING_STATUSES)[number], string> = {
  CONFIRMED: "bg-accent",
  HELD: "bg-glow",
  AWAITING_PAYMENT: "bg-glow/60",
  DECLINED: "bg-danger",
  EXPIRED: "bg-faint",
  CANCELLED: "bg-line-strong",
};

/**
 * Analytics straight from the database for a period (the last 90 days unless chosen), for this place or every place
 * the person may read: the key numbers, nights and revenue by month, channels, requests, and a row per place. The
 * filters are a plain form, so every view has its own link.
 */
export default async function AnalyticsPage({ params, searchParams }: PageProps) {
  const [{ businessId }, asked] = await Promise.all([params, searchParams]);
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.analytics.anyOf);
  const today = todayUtc();
  const end = toIsoDate(addDays(today, 1));
  const parsed = analyticsQuery.safeParse({
    from: asked.from ?? toIsoDate(addDays(today, -89)),
    to: asked.to ?? end,
  });
  const range = parsed.success ? parsed.data : { checkIn: addDays(today, -89), checkOut: addDays(today, 1) };
  const scope = asked.scope === "all" ? "all" : "place";
  const from = toIsoDate(range.checkIn);
  const to = toIsoDate(range.checkOut);
  const [t, tChannel, tStatus, locale, data] = await Promise.all([
    getTranslations("analytics"),
    getTranslations("dashboard.overview.channel"),
    getTranslations("dashboard.bookings.status"),
    getLocale(),
    getAnalytics(ctx, scope, range),
  ]);
  const { totals } = data;
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale as Locale);
  const moneyList = (rows: Array<{ currency: string; cents: number }>) =>
    rows.map((row) => money(row.cents, row.currency)).join(" · ") || money(0, totals.revenueCurrency);
  const month = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" });
  const monthLabel = (iso: string) => month.format(new Date(`${iso}-01T00:00:00Z`));
  const href = (changes: Record<string, string>) =>
    `?${new URLSearchParams({ from, to, scope, ...changes })}`;
  const requests = BOOKING_STATUSES.map((status) => ({ status, count: totals.requests[status] ?? 0 })).filter(
    (row) => row.count > 0,
  );
  const requestCount = requests.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />

      <form className="mb-8 flex flex-wrap items-end gap-3 rounded-xl bg-surface p-4 ring-1 ring-line">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((days) => {
            const start = toIsoDate(addDays(today, 1 - days));
            return (
              <Link
                key={days}
                href={href({ from: start, to: end })}
                className={clsx(
                  "h-9 rounded-full px-3.5 text-sm leading-9 font-semibold ring-1",
                  from === start && to === end
                    ? "bg-ink text-paper ring-ink"
                    : "ring-line hover:bg-surface-2",
                )}
              >
                {t(`presets.${days}`)}
              </Link>
            );
          })}
        </div>
        <label className="grid gap-1 text-xs font-semibold">
          {t("from")}
          <input type="date" name="from" defaultValue={from} className={clsx(inputClass, "h-9")} />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("to")}
          <input type="date" name="to" defaultValue={to} className={clsx(inputClass, "h-9")} />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("scope")}
          <select name="scope" defaultValue={scope} className={clsx(inputClass, "h-9")}>
            {SCOPES.map((option) => (
              <option key={option} value={option}>
                {t(`scopes.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm">
          {t("apply")}
        </Button>
      </form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("occupancy")}
          value={totals.occupancyRate}
          kind="percent"
          note={t("nightsOf", { sold: totals.nightsSold, available: totals.nightsAvailable })}
        />
        <div className="grid content-start gap-2 rounded-xl bg-surface p-5 ring-1 ring-line">
          <p className="text-sm font-semibold text-muted">{t("revenue")}</p>
          <p className="text-2xl font-semibold tabular-nums">{moneyList(totals.revenue)}</p>
        </div>
        <div className="grid content-start gap-2 rounded-xl bg-surface p-5 ring-1 ring-line">
          <p className="text-sm font-semibold text-muted">{t("saved")}</p>
          <p className="text-2xl font-semibold tabular-nums">{moneyList(totals.commissionSaved)}</p>
        </div>
        <StatTile label={t("requests")} value={requestCount} kind="count" />
        <StatTile label={t("nightsSold")} value={totals.nightsSold} kind="count" />
        <div className="grid content-start gap-2 rounded-xl bg-surface p-5 ring-1 ring-line">
          <p className="text-sm font-semibold text-muted">{t("response")}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {totals.medianResponseMinutes === null
              ? "—"
              : t("minutes", { count: totals.medianResponseMinutes })}
          </p>
        </div>
        <StatTile label={t("places")} value={data.places.length} kind="count" />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title={t("nightsByMonth")}>
          {totals.nightsByMonth.length > 0 ? (
            <BarChart
              bars={totals.nightsByMonth.map((row) => ({
                label: monthLabel(row.month),
                value: row.nights,
                title: `${monthLabel(row.month)}: ${t("nights", { count: row.nights })}`,
              }))}
            />
          ) : (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
        </Panel>
        <Panel
          title={t("revenueByMonth")}
          intro={
            totals.revenue.length > 1 ? t("currencyNote", { currency: totals.revenueCurrency }) : undefined
          }
        >
          {totals.revenueByMonth.length > 0 ? (
            <BarChart
              bars={totals.revenueByMonth.map((row) => ({
                label: monthLabel(row.month),
                value: row.cents,
                title: `${monthLabel(row.month)}: ${money(row.cents, totals.revenueCurrency)}`,
              }))}
            />
          ) : (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
        </Panel>
        <Panel title={t("channels")}>
          {totals.channels.length > 0 ? (
            <ShareBar
              shares={totals.channels.map((row) => ({
                label: tChannel(row.channel),
                value: row.nights,
                className: channelColor(row.channel),
              }))}
            />
          ) : (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
        </Panel>
        <Panel title={t("requestsByStatus")}>
          {requests.length > 0 ? (
            <ShareBar
              shares={requests.map((row) => ({
                label: tStatus(row.status),
                value: row.count,
                className: STATUS_COLOR[row.status],
              }))}
            />
          ) : (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
        </Panel>
      </div>

      {data.places.length > 1 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">{t("byPlace")}</h2>
          <div className="overflow-x-auto rounded-xl bg-surface ring-1 ring-line">
            <table className="w-full min-w-[540px] text-sm">
              <thead className="text-xs tracking-wide text-muted uppercase">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-start">{t("place")}</th>
                  <th className="px-4 py-3 text-end">{t("occupancy")}</th>
                  <th className="px-4 py-3 text-end">{t("nightsSold")}</th>
                  <th className="px-4 py-3 text-end">{t("revenue")}</th>
                  <th className="px-4 py-3 text-end">{t("saved")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.places.map((place) => (
                  <tr key={place.businessId} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold">{place.name}</td>
                    <td className="px-4 py-3 text-end">{Math.round(place.report.occupancyRate * 100)}%</td>
                    <td className="px-4 py-3 text-end">{place.report.nightsSold}</td>
                    <td className="px-4 py-3 text-end">
                      {money(place.report.directRevenueCents, place.report.currency)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {money(place.report.commissionSavedCents, place.report.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
