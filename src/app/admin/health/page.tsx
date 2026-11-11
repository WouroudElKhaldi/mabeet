import { AlertTriangle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { ListFilters } from "@/components/ui/list-filters";
import { Pagination } from "@/components/ui/pagination";
import { FEED_SOURCES } from "@/config/enums";
import { syncHealthQuery } from "@/modules/calendar-sync";
import { getSyncHealth } from "@/modules/calendar-sync/server";
import { requirePageAdmin } from "@/server/http/session";
import { listHref } from "@/utils/paging";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = "/admin/health";

/**
 * What runs on its own: the calendar links every room reads from Airbnb and Booking.com. The links whose last read
 * failed, or that have not been read for an hour, are a table with their place and room, found by name and source,
 * so the admin can tell the host.
 */
export default async function AdminHealthPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const { page, q, source } = syncHealthQuery.parse(await searchParams);
  const [t, tChannels, locale, sync] = await Promise.all([
    getTranslations("admin"),
    getTranslations("dashboard.channels"),
    getLocale(),
    getSyncHealth(actor, { q, source }, page),
  ]);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const filters = { q, source };

  return (
    <>
      <PageHeader
        title={t("nav.health")}
        intro={`${t("healthIntro")} ${t("sync.summary", { total: sync.total, problems: sync.problems })}`}
      />
      {sync.problems === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("sync.allGood")}</p>
      ) : (
        <>
          <ListFilters
            label={t("sync.filters")}
            path={PATH}
            search={q}
            searchPlaceholder={t("sync.searchPlaceholder")}
            total={sync.found}
            choices={[
              {
                name: "source",
                label: t("sync.source"),
                value: source,
                options: FEED_SOURCES.map((value) => ({ value, label: tChannels(`sources.${value}`) })),
              },
            ]}
          />
          {sync.needsLook.length === 0 ? (
            <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("sync.noMatch")}</p>
          ) : (
            <DataTable
              label={t("sync.title")}
              columns={[
                { label: t("sync.place") },
                { label: t("sync.source"), wide: true },
                { label: t("sync.lastRead"), wide: true },
                { label: t("sync.problem") },
              ]}
            >
              {sync.needsLook.map((feed) => (
                <DataRow key={feed.id}>
                  <DataCell>
                    <p className="font-semibold">
                      <bdi>{feed.business.name}</bdi>
                    </p>
                    <p className="text-muted">
                      <bdi>{feed.room.name}</bdi>
                      <span className="md:hidden"> · {tChannels(`sources.${feed.source}`)}</span>
                    </p>
                    <p dir="ltr" className="max-w-72 truncate text-start text-xs text-faint">
                      {feed.url}
                    </p>
                  </DataCell>
                  <DataCell wide>{tChannels(`sources.${feed.source}`)}</DataCell>
                  <DataCell wide className="whitespace-nowrap text-muted">
                    {feed.lastSyncedAt ? when.format(feed.lastSyncedAt) : t("sync.never")}
                  </DataCell>
                  <DataCell>
                    <p className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                      <span className="font-semibold text-danger">{feed.lastError ?? t("sync.notRead")}</span>
                    </p>
                  </DataCell>
                </DataRow>
              ))}
            </DataTable>
          )}
          <Pagination
            order="list"
            page={sync.page}
            pages={sync.pages}
            href={(target) => listHref(PATH, filters, target)}
          />
        </>
      )}
    </>
  );
}
