import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { CopyField } from "@/components/ui/copy-field";
import { getCalendarLinks } from "@/modules/bookings/server";
import { AddFeedForm, FeedButtons } from "@/modules/calendar-sync";
import { requirePageAccess } from "@/server/http/session";

type PageProps = { params: Promise<{ businessId: string }> };

/** A link the worker reads every ten minutes that has not been read for an hour is worth a look. */
const STALE_AFTER_MS = 60 * 60_000;

/**
 * The calendar links: each room's own link to paste into Airbnb and Booking.com, and the links it reads back, with
 * how the last read went, "Sync now" and "Remove".
 */
export default async function ChannelsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.channels.anyOf);
  const [t, locale, rooms] = await Promise.all([
    getTranslations("dashboard.channels"),
    getLocale(),
    getCalendarLinks(ctx),
  ]);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const staleBefore = Date.now() - STALE_AFTER_MS;

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid grid-cols-1 gap-6">
        <p className="flex items-start gap-2 rounded-lg bg-accent-soft px-4 py-3 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          {t("readHint")}
        </p>
        {rooms.length === 0 ? (
          <p className="rounded-xl bg-surface px-4 py-16 text-center text-sm text-muted ring-1 ring-line">
            {t("noRooms")}
          </p>
        ) : (
          rooms.map((room) => (
            <Panel key={room.id} title={room.name} intro={room.active ? undefined : t("roomOff")}>
              <div className="grid grid-cols-1 gap-6">
                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold">{t("exportTitle")}</h3>
                  <p className="text-sm text-muted">{t("exportHint")}</p>
                  <CopyField value={room.exportUrl} label={t("exportTitle")} />
                </section>
                <section className="grid gap-3">
                  <h3 className="text-sm font-semibold">{t("importTitle")}</h3>
                  {room.feeds.length === 0 ? (
                    <p className="text-sm text-muted">{t("noFeeds")}</p>
                  ) : (
                    <ul className="grid gap-2">
                      {room.feeds.map((feed) => {
                        const stale = !feed.lastSyncedAt || feed.lastSyncedAt.getTime() < staleBefore;
                        return (
                          <li
                            key={feed.id}
                            className="flex flex-wrap items-center gap-3 rounded-md bg-surface-2 px-4 py-3"
                          >
                            {feed.lastError || stale ? (
                              <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
                            ) : (
                              <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold">{t(`sources.${feed.source}`)}</p>
                              <p dir="ltr" className="truncate text-start text-xs text-faint">
                                {feed.url}
                              </p>
                              <p className="text-xs text-muted">
                                {feed.lastSyncedAt
                                  ? t("lastSynced", { when: when.format(feed.lastSyncedAt) })
                                  : t("neverSynced")}
                              </p>
                              {feed.lastError ? (
                                <p className="text-xs font-semibold text-danger">{feed.lastError}</p>
                              ) : stale ? (
                                <p className="text-xs font-semibold text-danger">{t("stale")}</p>
                              ) : null}
                            </div>
                            <FeedButtons businessId={businessId} feedId={feed.id} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <AddFeedForm businessId={businessId} roomId={room.id} />
                </section>
              </div>
            </Panel>
          ))
        )}
      </div>
    </>
  );
}
