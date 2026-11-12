import { getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { ListFilters } from "@/components/ui/list-filters";
import { Pagination } from "@/components/ui/pagination";
import { Pill } from "@/components/ui/pill";
import { PARTNER_KINDS, PARTNER_LIST_STATES } from "@/config/partner-kinds";
import { REGION_KEYS } from "@/config/regions";
import { FeaturedPlaces, NewPartnerButton, PartnerActions, partnersQuery } from "@/modules/partners";
import { listFeaturedPlacesForAdmin, listPartnerPage } from "@/modules/partners/server";
import { listPlatformBusinesses } from "@/modules/workspaces/server";
import { requirePageAdmin } from "@/server/http/session";
import { todayUtc, toIsoDate } from "@/utils/dates";
import { listHref } from "@/utils/paging";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = "/admin/partners";

/**
 * The guesthouses featured in search, then the partner places near our guesthouses as a table with the days each is
 * sponsored; adding and editing pop up.
 */
export default async function AdminPartnersPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const now = new Date();
  const today = toIsoDate(todayUtc(now));
  const { page, q, kind, region, shown } = partnersQuery.parse(await searchParams);
  const [t, kinds, regions, list, featured, platform] = await Promise.all([
    getTranslations("admin.partners"),
    getTranslations("partners.kinds"),
    getTranslations("regions.names"),
    listPartnerPage(actor, { q, kind, region, removed: shown === "removed" }, page, now),
    listFeaturedPlacesForAdmin(actor, now),
    listPlatformBusinesses(actor),
  ]);
  const openPlaces = platform.businesses
    .filter((business) => business.status === "ACTIVE")
    .map(({ id, name }) => ({ id, name }))
    .sort((first, second) => first.name.localeCompare(second.name));
  const filtered = Boolean(q || kind || region || shown);
  // Every partner's region was checked against the list when it was saved; the database only knows it as text.
  const regionName = (key: string) => {
    const known = REGION_KEYS.find((region) => region === key);
    return known ? regions(known) : key;
  };

  return (
    <>
      <PageHeader title={t("title")} intro={t("hint")} actions={<NewPartnerButton />} />
      <Panel title={t("featuredTitle")} intro={t("featuredHint")}>
        <FeaturedPlaces featured={featured} places={openPlaces} />
      </Panel>
      <ListFilters
        label={t("filters")}
        path={PATH}
        search={q}
        searchPlaceholder={t("searchPlaceholder")}
        total={list.total}
        choices={[
          {
            name: "kind",
            label: t("kind"),
            value: kind,
            options: PARTNER_KINDS.map((value) => ({ value, label: kinds(value) })),
          },
          {
            name: "region",
            label: t("region"),
            value: region,
            options: REGION_KEYS.map((value) => ({ value, label: regions(value) })),
          },
          {
            name: "shown",
            label: t("shown"),
            value: shown,
            options: PARTNER_LIST_STATES.map((value) => ({ value, label: t(`shownStates.${value}`) })),
          },
        ]}
      />
      {list.partners.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">
          {filtered ? t("noMatch") : t("empty")}
        </p>
      ) : (
        <DataTable
          label={t("title")}
          columns={[
            { label: t("partner") },
            { label: t("kind"), wide: true },
            { label: t("region"), wide: true },
            { label: t("sponsored"), wide: true },
            { label: t("actions"), align: "end", hiddenLabel: true },
          ]}
        >
          {list.partners.map((partner) => {
            const sponsoredNow = partner.sponsorships.some((sponsorship) => sponsorship.startsOn <= today);
            return (
              <DataRow key={partner.id}>
                <DataCell>
                  <p className="font-semibold">
                    <bdi>{partner.name}</bdi>
                  </p>
                  {partner.area ? (
                    <p className="text-muted">
                      <bdi>{partner.area}</bdi>
                    </p>
                  ) : null}
                </DataCell>
                <DataCell wide>{kinds(partner.kind)}</DataCell>
                <DataCell wide>{regionName(partner.region)}</DataCell>
                <DataCell wide>
                  {sponsoredNow ? (
                    <Pill tone="accent">{t("sponsoredNow")}</Pill>
                  ) : partner.sponsorships.length > 0 ? (
                    t("sponsoredLater")
                  ) : (
                    "—"
                  )}
                </DataCell>
                <DataCell align="end">
                  <PartnerActions partner={partner} />
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
        href={(target) => listHref(PATH, { q, kind, region, shown }, target)}
      />
    </>
  );
}
