import { Send } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { MoneyTabs, moneyTabPath } from "@/components/admin/money-tabs";
import { PageHeader } from "@/components/shell/page-header";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListFilters } from "@/components/ui/list-filters";
import { Pagination } from "@/components/ui/pagination";
import { PAYOUT_METHODS } from "@/config/enums";
import { PayoutDecision, payoutRequestsQuery } from "@/modules/payments";
import { listPayoutRequests } from "@/modules/payments/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate, formatMoney } from "@/utils/format";
import { listHref } from "@/utils/paging";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = moneyTabPath("requests");

/**
 * The payouts hosts asked for, the oldest first, a page at a time, found by place or account name and by how each is
 * sent. The admin sends the money by hand from Mabeet's Whish or Stripe account, then marks it sent in a pop-up.
 */
export default async function AdminPayoutRequestsPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const { page, q, method } = payoutRequestsQuery.parse(await searchParams);
  const [t, tMethods, locale, list] = await Promise.all([
    getTranslations("admin.money"),
    getTranslations("dashboard.payouts.methods"),
    getLocale(),
    listPayoutRequests(actor, { q, method }, page),
  ]);
  const filters = { q, method };

  return (
    <>
      <PageHeader title={t("title")} intro={t("requestsIntro")} />
      <MoneyTabs current="requests" />
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
        ]}
      />
      {list.payouts.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("noRequests")}</p>
      ) : (
        <DataTable
          label={t("tabs.requests")}
          columns={[
            { label: t("amount") },
            { label: t("place") },
            { label: t("sendTo"), wide: true },
            { label: t("asked"), wide: true },
            { label: t("actions"), align: "end", hiddenLabel: true },
          ]}
        >
          {list.payouts.map((payout) => {
            const amount = formatMoney(payout.amountCents, payout.currency, locale);
            const account =
              payout.method === "WHISH" ? (payout.whishPhone ?? "") : `${payout.bankName} ${payout.iban}`;
            return (
              <DataRow key={payout.id}>
                <DataCell className="font-semibold whitespace-nowrap tabular-nums">{amount}</DataCell>
                <DataCell>
                  <bdi className="font-semibold">{payout.business.name}</bdi>
                  <p className="text-muted md:hidden">{tMethods(payout.method)}</p>
                </DataCell>
                <DataCell wide>
                  <p>
                    {tMethods(payout.method)} · <bdi>{payout.accountName}</bdi>
                  </p>
                  <p className="text-muted">
                    <bdi dir="ltr">{account}</bdi>
                  </p>
                </DataCell>
                <DataCell wide className="whitespace-nowrap text-muted">
                  {formatDate(toIsoDate(payout.createdAt), locale)}
                </DataCell>
                <DataCell align="end">
                  <FormDialog
                    label={t("decide")}
                    title={t("decideTitle", { amount, place: payout.business.name })}
                    intro={`${tMethods(payout.method)} · ${payout.accountName} · ${account}`}
                    icon={Send}
                    variant="secondary"
                  >
                    <PayoutDecision payoutId={payout.id} />
                  </FormDialog>
                </DataCell>
              </DataRow>
            );
          })}
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
