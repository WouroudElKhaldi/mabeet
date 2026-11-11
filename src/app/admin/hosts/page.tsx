import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { ListFilters } from "@/components/ui/list-filters";
import { Pagination } from "@/components/ui/pagination";
import { Pill } from "@/components/ui/pill";
import { BUSINESS_STATUSES } from "@/config/enums";
import { PLANS } from "@/config/plans";
import { platformHostsQuery } from "@/modules/workspaces";
import { listPlatformHosts } from "@/modules/workspaces/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate } from "@/utils/format";
import { listHref } from "@/utils/paging";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = "/admin/hosts";

/**
 * Every host (a person who owns a live place) as a table, page by page, searched by name, email, phone or place, and
 * filtered by their places' status or plan. "Open" leads to the host's page: their contacts, profile and places.
 */
export default async function AdminHostsPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const { page, q, status, plan } = platformHostsQuery.parse(await searchParams);
  const [t, tPlans, tStatus, locale, list] = await Promise.all([
    getTranslations("admin.hosts"),
    getTranslations("plans.names"),
    getTranslations("admin.hosts.statuses"),
    getLocale(),
    listPlatformHosts(actor, { q, status, plan }, page),
  ]);
  const filters = { q, status, plan };

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <ListFilters
        label={t("filters")}
        path={PATH}
        search={q}
        searchPlaceholder={t("searchPlaceholder")}
        total={list.total}
        choices={[
          {
            name: "status",
            label: t("status"),
            value: status,
            options: BUSINESS_STATUSES.map((value) => ({ value, label: tStatus(value) })),
          },
          {
            name: "plan",
            label: t("plan"),
            value: plan,
            options: PLANS.map((value) => ({ value, label: tPlans(value) })),
          },
        ]}
      />
      {list.hosts.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("empty")}</p>
      ) : (
        <DataTable
          label={t("title")}
          columns={[
            { label: t("host") },
            { label: t("phone"), wide: true },
            { label: t("businesses") },
            { label: t("plan"), wide: true },
            { label: t("since"), wide: true },
            { label: t("details"), align: "end", hiddenLabel: true },
          ]}
        >
          {list.hosts.map((host) => (
            <DataRow key={host.id}>
              <DataCell>
                <p className="font-semibold">
                  <bdi>{host.name}</bdi>
                </p>
                <p className="max-w-56 truncate text-muted">
                  <bdi dir="ltr">{host.email}</bdi>
                </p>
              </DataCell>
              <DataCell wide>{host.phone ? <bdi dir="ltr">{host.phone}</bdi> : "—"}</DataCell>
              <DataCell>
                <ul className="grid gap-1">
                  {host.places.map((place) => (
                    <li key={place.id} className="flex flex-wrap items-center gap-2">
                      <bdi>{place.name}</bdi>
                      {place.status === "SUSPENDED" && <Pill>{tStatus("SUSPENDED")}</Pill>}
                    </li>
                  ))}
                </ul>
              </DataCell>
              <DataCell wide>
                {[...new Set(host.places.map((place) => place.plan))].map((name) => tPlans(name)).join(", ")}
              </DataCell>
              <DataCell wide className="whitespace-nowrap text-muted">
                {formatDate(toIsoDate(host.createdAt), locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </DataCell>
              <DataCell align="end">
                <ArrowLink href={`/admin/hosts/${host.id}`}>
                  {t("openHost")}
                  <span className="sr-only"> {host.name}</span>
                </ArrowLink>
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
