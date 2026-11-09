import { AlertTriangle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { getSyncHealth } from "@/modules/calendar-sync/server";
import { requirePageAdmin } from "@/server/http/session";

/**
 * What runs on its own: the calendar links every room reads from Airbnb and Booking.com. The links whose last read
 * failed, or that have not been read for an hour, are listed with their place, so the admin can tell the host.
 */
export default async function AdminHealthPage() {
  const actor = await requirePageAdmin();
  const [t, tChannels, locale, sync] = await Promise.all([
    getTranslations("admin"),
    getTranslations("dashboard.channels"),
    getLocale(),
    getSyncHealth(actor),
  ]);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <PageHeader title={t("nav.health")} intro={t("healthIntro")} />
      <Panel
        title={t("sync.title")}
        intro={t("sync.summary", { total: sync.total, problems: sync.problems })}
      >
        {sync.problems === 0 ? (
          <p className="text-sm text-muted">{t("sync.allGood")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {sync.needsLook.map((feed) => (
              <li key={feed.id} className="flex items-start gap-3 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold">
                    <bdi>{feed.business.name}</bdi> · <bdi>{feed.room.name}</bdi> ·{" "}
                    {tChannels(`sources.${feed.source}`)}
                  </p>
                  <p dir="ltr" className="truncate text-start text-xs text-faint">
                    {feed.url}
                  </p>
                  <p className="text-xs text-muted">
                    {feed.lastSyncedAt
                      ? t("sync.lastSynced", { when: when.format(feed.lastSyncedAt) })
                      : t("sync.never")}
                  </p>
                  {feed.lastError && <p className="text-xs font-semibold text-danger">{feed.lastError}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
