import { getLocale, getTranslations } from "next-intl/server";
import { MoneyTabs, moneyTabPath } from "@/components/admin/money-tabs";
import { PageHeader } from "@/components/shell/page-header";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { ListFilters } from "@/components/ui/list-filters";
import { Pagination } from "@/components/ui/pagination";
import { listQuery } from "@/lib/schemas";
import { getHostBalances } from "@/modules/bookings/server";
import { requirePageAdmin } from "@/server/http/session";
import { formatMoney } from "@/utils/format";
import { listHref } from "@/utils/paging";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = moneyTabPath("balances");

/**
 * What Mabeet holds for each host from online payments, net of refunds and payouts, one row per place and currency,
 * the most available first, found by the place's name.
 */
export default async function AdminBalancesPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const { page, q } = listQuery.parse(await searchParams);
  const [t, locale, list] = await Promise.all([
    getTranslations("admin.money"),
    getLocale(),
    getHostBalances(actor, q, page),
  ]);
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);

  return (
    <>
      <PageHeader title={t("title")} intro={t("owedIntro")} />
      <MoneyTabs current="balances" />
      <ListFilters
        label={t("filters")}
        path={PATH}
        search={q}
        searchPlaceholder={t("searchPlaces")}
        total={list.total}
      />
      {list.balances.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("nothingOwed")}</p>
      ) : (
        <DataTable
          label={t("tabs.balances")}
          columns={[
            { label: t("place") },
            { label: t("available"), align: "end" },
            { label: t("upcoming"), align: "end", wide: true },
            { label: t("requested"), align: "end", wide: true },
            { label: t("paidOut"), align: "end", wide: true },
          ]}
        >
          {list.balances.map((balance) => (
            <DataRow key={`${balance.businessId}:${balance.currency}`}>
              <DataCell>
                <bdi className="font-semibold">{balance.placeName}</bdi>
              </DataCell>
              <DataCell align="end" className="font-semibold tabular-nums">
                {money(balance.availableCents, balance.currency)}
              </DataCell>
              <DataCell align="end" wide className="tabular-nums">
                {money(balance.upcomingCents, balance.currency)}
              </DataCell>
              <DataCell align="end" wide className="tabular-nums">
                {money(balance.requestedCents, balance.currency)}
              </DataCell>
              <DataCell align="end" wide className="tabular-nums">
                {money(balance.paidOutCents, balance.currency)}
              </DataCell>
            </DataRow>
          ))}
        </DataTable>
      )}
      <Pagination
        order="list"
        page={list.page}
        pages={list.pages}
        href={(target) => listHref(PATH, { q }, target)}
      />
    </>
  );
}
