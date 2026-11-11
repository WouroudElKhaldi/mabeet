import { getLocale, getTranslations } from "next-intl/server";
import { MoneyTabs, moneyTabPath } from "@/components/admin/money-tabs";
import { PageHeader } from "@/components/shell/page-header";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { ListFilters } from "@/components/ui/list-filters";
import { Pagination } from "@/components/ui/pagination";
import { Pill } from "@/components/ui/pill";
import { DECIDED_PAYOUT_STATUSES, PAYOUT_METHODS } from "@/config/enums";
import { payoutHistoryQuery } from "@/modules/payments";
import { listPayoutHistory } from "@/modules/payments/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate, formatMoney } from "@/utils/format";
import { listHref } from "@/utils/paging";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = moneyTabPath("history");

/**
 * Payouts already sent or refused, the latest first, a page at a time, found by place or account name, how each was
 * sent and whether it was sent or refused, with the transfer's reference.
 */
export default async function AdminPayoutHistoryPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const { page, q, method, status } = payoutHistoryQuery.parse(await searchParams);
  const [t, tMethods, locale, list] = await Promise.all([
    getTranslations("admin.money"),
    getTranslations("dashboard.payouts.methods"),
    getLocale(),
    listPayoutHistory(actor, { q, method, status }, page),
  ]);
  const filters = { q, method, status };

  return (
    <>
      <PageHeader title={t("title")} intro={t("historyIntro")} />
      <MoneyTabs current="history" />
      <ListFilters
        label={t("filters")}
        path={PATH}
        search={q}
        searchPlaceholder={t("searchPayouts")}
        total={list.total}
        choices={[
          {
            name: "method",
            label: t("sendTo"),
            value: method,
            options: PAYOUT_METHODS.map((value) => ({ value, label: tMethods(value) })),
          },
          {
            name: "status",
            label: t("statusLabel"),
            value: status,
            options: DECIDED_PAYOUT_STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
          },
        ]}
      />
      {list.payouts.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("noHistory")}</p>
      ) : (
        <DataTable
          label={t("tabs.history")}
          columns={[
            { label: t("amount") },
            { label: t("place") },
            { label: t("sendTo"), wide: true },
            { label: t("decided"), wide: true },
            { label: t("reference"), wide: true },
            { label: t("statusLabel"), align: "end" },
          ]}
        >
          {list.payouts.map((payout) => (
            <DataRow key={payout.id}>
              <DataCell className="font-semibold whitespace-nowrap tabular-nums">
                {formatMoney(payout.amountCents, payout.currency, locale)}
              </DataCell>
              <DataCell>
                <bdi className="font-semibold">{payout.business.name}</bdi>
              </DataCell>
              <DataCell wide>
                {tMethods(payout.method)} · <bdi>{payout.accountName}</bdi>
              </DataCell>
              <DataCell wide className="whitespace-nowrap text-muted">
                {payout.decidedAt ? formatDate(toIsoDate(payout.decidedAt), locale) : "—"}
              </DataCell>
              <DataCell wide>{payout.reference ? <bdi dir="ltr">{payout.reference}</bdi> : "—"}</DataCell>
              <DataCell align="end">
                <Pill tone={payout.status === "PAID" ? "accent" : "quiet"}>
                  {t(`status.${payout.status}`)}
                </Pill>
              </DataCell>
            </DataRow>
          ))}
        </DataTable>
      )}
      <Pagination
        order="list"
        page={list.page}
        pages={list.pages}
        href={(target) => listHref(PATH, filters, target)}
      />
    </>
  );
}
