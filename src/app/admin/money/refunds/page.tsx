import { Undo2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { MoneyTabs, moneyTabPath } from "@/components/admin/money-tabs";
import { PageHeader } from "@/components/shell/page-header";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListFilters } from "@/components/ui/list-filters";
import { Pagination } from "@/components/ui/pagination";
import { listQuery } from "@/lib/schemas";
import { RefundSent } from "@/modules/bookings";
import { listRefundsToSend } from "@/modules/bookings/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate, formatMoney } from "@/utils/format";
import { listHref } from "@/utils/paging";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = moneyTabPath("refunds");

/**
 * Refunds a provider kept refusing, the oldest first, a page at a time, found by place, guest or booking reference.
 * Refunds are automatic and in full; these few the admin sends by hand, then marks sent in a pop-up.
 */
export default async function AdminRefundsPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const { page, q } = listQuery.parse(await searchParams);
  const [t, tMethods, locale, list] = await Promise.all([
    getTranslations("admin.money"),
    getTranslations("dashboard.payouts.methods"),
    getLocale(),
    listRefundsToSend(actor, q, page),
  ]);

  return (
    <>
      <PageHeader title={t("title")} intro={t("refundsIntro")} />
      <MoneyTabs current="refunds" />
      <ListFilters
        label={t("filters")}
        path={PATH}
        search={q}
        searchPlaceholder={t("searchRefunds")}
        total={list.total}
      />
      {list.refunds.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("noRefunds")}</p>
      ) : (
        <DataTable
          label={t("tabs.refunds")}
          columns={[
            { label: t("amount") },
            { label: t("guest") },
            { label: t("place"), wide: true },
            { label: t("paidWith"), wide: true },
            { label: t("recorded"), wide: true },
            { label: t("actions"), align: "end", hiddenLabel: true },
          ]}
        >
          {list.refunds.map((refund) => {
            const booking = refund.payment.booking;
            const amount = formatMoney(refund.amountCents, refund.currency, locale);
            const paidWith = refund.payment.method === "WHISH" ? tMethods("WHISH") : t("card");
            return (
              <DataRow key={refund.id}>
                <DataCell className="font-semibold whitespace-nowrap tabular-nums">{amount}</DataCell>
                <DataCell>
                  <bdi className="font-semibold">{booking?.guestName}</bdi>
                  <p className="text-muted">
                    <bdi dir="ltr">{booking?.reference}</bdi>
                    {booking?.guestPhone && (
                      <>
                        {" · "}
                        <bdi dir="ltr">{booking.guestPhone}</bdi>
                      </>
                    )}
                  </p>
                </DataCell>
                <DataCell wide>
                  <bdi>{refund.business.name}</bdi>
                </DataCell>
                <DataCell wide>{paidWith}</DataCell>
                <DataCell wide className="whitespace-nowrap text-muted">
                  {formatDate(toIsoDate(refund.createdAt), locale)}
                </DataCell>
                <DataCell align="end">
                  <FormDialog
                    label={t("markSent")}
                    title={t("refundTitle", { amount, guest: booking?.guestName ?? "" })}
                    intro={[paidWith, booking?.guestPhone, booking?.guestEmail].filter(Boolean).join(" · ")}
                    icon={Undo2}
                    variant="secondary"
                  >
                    <RefundSent refundId={refund.id} />
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
        href={(target) => listHref(PATH, { q }, target)}
      />
    </>
  );
}
