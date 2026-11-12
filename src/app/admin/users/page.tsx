import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { ListFilters } from "@/components/ui/list-filters";
import { Pagination } from "@/components/ui/pagination";
import { Pill } from "@/components/ui/pill";
import { PERSON_KINDS, type PersonKind } from "@/config/enums";
import { platformPeopleQuery } from "@/modules/accounts";
import { listPlatformPeople } from "@/modules/accounts/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate } from "@/utils/format";
import { listHref } from "@/utils/paging";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = "/admin/users";

/** What a person is, the way the kind filter says it. */
function kindOf(person: { platformRole: string; ownsPlace: boolean; placeCount: number }): PersonKind {
  if (person.platformRole === "SUPER_ADMIN") return "admin";
  if (person.ownsPlace) return "host";
  return person.placeCount > 0 ? "team" : "guest";
}

/**
 * Everyone with an account as a table, page by page: guests, hosts and their teams, and the platform admins,
 * searched by name, email or phone. "Open" leads to the person's page.
 */
export default async function AdminUsersPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const { page, q, kind } = platformPeopleQuery.parse(await searchParams);
  const [t, locale, list] = await Promise.all([
    getTranslations("admin.people"),
    getLocale(),
    listPlatformPeople(actor, { q, kind }, page),
  ]);

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
            name: "kind",
            label: t("kind"),
            value: kind,
            options: PERSON_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) })),
          },
        ]}
      />
      {list.people.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("empty")}</p>
      ) : (
        <DataTable
          label={t("title")}
          columns={[
            { label: t("person") },
            { label: t("kind") },
            { label: t("places"), align: "end", wide: true },
            { label: t("trips"), align: "end", wide: true },
            { label: t("joined"), wide: true },
            { label: t("details"), align: "end", hiddenLabel: true },
          ]}
        >
          {list.people.map((person) => {
            const personKind = kindOf(person);
            return (
              <DataRow key={person.id}>
                <DataCell>
                  <p className="font-semibold">
                    <bdi>{person.name}</bdi>
                  </p>
                  <p className="max-w-40 truncate text-muted md:max-w-56">
                    <bdi dir="ltr">{person.email}</bdi>
                  </p>
                </DataCell>
                <DataCell>
                  <Pill tone={personKind === "admin" ? "accent" : "quiet"}>{t(`kinds.${personKind}`)}</Pill>
                </DataCell>
                <DataCell align="end" wide className="tabular-nums">
                  {person.placeCount}
                </DataCell>
                <DataCell align="end" wide className="tabular-nums">
                  {person.tripCount}
                </DataCell>
                <DataCell wide className="whitespace-nowrap text-muted">
                  {formatDate(toIsoDate(person.createdAt), locale, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </DataCell>
                <DataCell align="end">
                  <ArrowLink href={`/admin/users/${person.id}`}>
                    {t("open")}
                    <span className="sr-only"> {person.name}</span>
                  </ArrowLink>
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
        href={(target) => listHref(PATH, { q, kind }, target)}
      />
    </>
  );
}
