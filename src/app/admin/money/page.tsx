import { getLocale, getTranslations } from "next-intl/server";
import { MoneyTabs } from "@/components/admin/money-tabs";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { StatTile } from "@/components/ui/stat-tile";
import { getPlanRevenue } from "@/modules/billing/server";
import { listRefundsToSend } from "@/modules/bookings/server";
import { listPayoutRequests } from "@/modules/payments/server";
import { requirePageAdmin } from "@/server/http/session";
import { formatDate, formatMoney } from "@/utils/format";

/** The currency the revenue tiles show; every plan is priced in it. */
const PLAN_CURRENCY = "USD";

/**
 * The platform's money at a glance: what Mabeet earned from plans, how much waits to be sent, and plan revenue month
 * by month. The long lists (payouts and refunds to send, what each host is owed, past payouts) are tabs of their own.
 */
export default async function AdminMoneyPage() {
  const actor = await requirePageAdmin();
  const [t, locale, revenue, requests, refunds] = await Promise.all([
    getTranslations("admin.money"),
    getLocale(),
    getPlanRevenue(actor),
    listPayoutRequests(actor),
    listRefundsToSend(actor),
  ]);
  const usd = (rows: Array<{ currency: string; cents: number; payments?: number }>) =>
    rows.find((row) => row.currency === PLAN_CURRENCY);
  const months = [...new Set(revenue.byMonth.map((row) => row.month))].reverse();

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <MoneyTabs current="overview" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
        <section aria-label={t("earnedAll")} className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile
            kind="money"
            currency={PLAN_CURRENCY}
            label={t("earnedAll")}
            value={usd(revenue.allTime)?.cents ?? 0}
          />
          <StatTile
            kind="money"
            currency={PLAN_CURRENCY}
            label={t("earnedMonth")}
            value={usd(revenue.thisMonth)?.cents ?? 0}
            note={t("payments", { count: usd(revenue.thisMonth)?.payments ?? 0 })}
          />
          <StatTile
            kind="money"
            currency={PLAN_CURRENCY}
            label={t("byCard")}
            value={usd(revenue.byCard)?.cents ?? 0}
            note={t("payments", { count: usd(revenue.byCard)?.payments ?? 0 })}
          />
          <StatTile
            kind="money"
            currency={PLAN_CURRENCY}
            label={t("byWhish")}
            value={usd(revenue.byWhish)?.cents ?? 0}
            note={t("payments", { count: usd(revenue.byWhish)?.payments ?? 0 })}
          />
          <StatTile kind="count" label={t("tabs.requests")} value={requests.total} />
          <StatTile kind="count" label={t("tabs.refunds")} value={refunds.total} />
        </section>

        <Panel title={t("byMonth")}>
          {months.length === 0 ? (
            <p className="text-sm text-muted">{t("payments", { count: 0 })}</p>
          ) : (
            <DataTable
              label={t("byMonth")}
              columns={[
                { label: t("month") },
                { label: t("paymentsColumn"), align: "end" },
                { label: t("earned"), align: "end" },
              ]}
            >
              {months.map((month) => {
                const rows = revenue.byMonth.filter(
                  (row) => row.month === month && row.currency === PLAN_CURRENCY,
                );
                return (
                  <DataRow key={month}>
                    <DataCell className="font-semibold">
                      {formatDate(`${month}-01`, locale, { month: "long", year: "numeric" })}
                    </DataCell>
                    <DataCell align="end" className="tabular-nums">
                      {rows.reduce((sum, row) => sum + row.payments, 0)}
                    </DataCell>
                    <DataCell align="end" className="tabular-nums">
                      {formatMoney(
                        rows.reduce((sum, row) => sum + row.cents, 0),
                        PLAN_CURRENCY,
                        locale,
                      )}
                    </DataCell>
                  </DataRow>
                );
              })}
            </DataTable>
          )}
        </Panel>
      </div>
    </>
  );
}
