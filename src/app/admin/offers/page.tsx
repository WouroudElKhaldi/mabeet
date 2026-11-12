import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { ListFilters } from "@/components/ui/list-filters";
import { Pagination } from "@/components/ui/pagination";
import { Pill } from "@/components/ui/pill";
import { OFFER_KINDS } from "@/config/plans";
import { EndOfferButton, NewOfferButton, offersQuery } from "@/modules/billing";
import { listOffersForAdmin } from "@/modules/billing/server";
import { listPlatformBusinesses } from "@/modules/workspaces/server";
import { requirePageAdmin } from "@/server/http/session";
import { addDays, toIsoDate } from "@/utils/dates";
import { formatDate } from "@/utils/format";
import { listHref } from "@/utils/paging";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = "/admin/offers";

/** Plan offers for hosts as a table: a plan free or a share off it, for every place or one, for a time. */
export default async function AdminOffersPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const { page, q, kind } = offersQuery.parse(await searchParams);
  const [t, tPlans, locale, list, { businesses }] = await Promise.all([
    getTranslations("admin.offers"),
    getTranslations("plans.names"),
    getLocale(),
    listOffersForAdmin(actor, { q, kind }, page),
    listPlatformBusinesses(actor),
  ]);
  const day = (date: Date) =>
    formatDate(toIsoDate(date), locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          <NewOfferButton
            places={businesses.map((business) => ({
              id: business.id,
              name: business.name,
              owner: business.owners[0]?.name ?? null,
            }))}
          />
        }
      />
      <ListFilters
        label={t("filters")}
        path={PATH}
        search={q}
        searchPlaceholder={t("searchPlaceholder")}
        total={list.total}
        choices={[
          {
            name: "kind",
            label: t("gives"),
            value: kind,
            options: OFFER_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) })),
          },
        ]}
      />
      {list.offers.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">
          {q || kind ? t("noMatch") : t("empty")}
        </p>
      ) : (
        <DataTable
          label={t("listTitle")}
          columns={[
            { label: t("offer") },
            { label: t("when"), wide: true },
            { label: t("for"), wide: true },
            { label: t("used"), align: "end", wide: true },
            { label: t("end"), align: "end", hiddenLabel: true },
          ]}
        >
          {list.offers.map((offer) => (
            <DataRow key={offer.id}>
              <DataCell>
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <bdi>{offer.name}</bdi>
                  <Pill tone={offer.state === "running" ? "accent" : "quiet"}>
                    {t(`states.${offer.state}`)}
                  </Pill>
                </p>
                <p className="text-muted">
                  {offer.kind === "FREE"
                    ? t("givesFree", { plan: tPlans(offer.plan) })
                    : t("givesPercent", { plan: tPlans(offer.plan), percent: offer.percentOff ?? 0 })}
                </p>
              </DataCell>
              <DataCell wide>
                {offer.firstMonths !== null
                  ? t("whenFirstMonths", { count: offer.firstMonths })
                  : offer.startsAt && offer.endsAt
                    ? // endsAt is the day after the last one: an offer runs to the end of its last day.
                      t("whenDates", { from: day(offer.startsAt), to: day(addDays(offer.endsAt, -1)) })
                    : null}
              </DataCell>
              <DataCell wide>{offer.placeName ? <bdi>{offer.placeName}</bdi> : t("forEveryPlace")}</DataCell>
              <DataCell align="end" wide className="text-muted">
                {offer.kind === "FREE"
                  ? t("claims", { count: offer.claims })
                  : t("payments", { count: offer.payments })}
              </DataCell>
              <DataCell align="end">
                {offer.state === "running" || offer.state === "upcoming" ? (
                  <EndOfferButton offer={{ id: offer.id, name: offer.name }} />
                ) : null}
              </DataCell>
            </DataRow>
          ))}
        </DataTable>
      )}
      <Pagination
        order="list"
        page={list.page}
        pages={list.pages}
        href={(target) => listHref(PATH, { q, kind }, target)}
      />
    </>
  );
}
