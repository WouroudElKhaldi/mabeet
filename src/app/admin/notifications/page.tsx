import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { Pagination } from "@/components/ui/pagination";
import { NotificationList, PhoneAlerts } from "@/modules/notifications";
import { getPlatformNotifications, markSeen, pushPublicKey } from "@/modules/notifications/server";
import { requirePageAdmin } from "@/server/http/session";

type PageProps = { searchParams: Promise<{ page?: string }> };

/** What needs the admin across every business, page by page, and phone alerts for it. */
export default async function AdminNotificationsPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const page = Number((await searchParams).page ?? 1) || 1;
  const [t, tPwa, { items, seenAt, page: current, pages }] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("pwa"),
    getPlatformNotifications(actor, page),
  ]);
  // Read once shown: the list still marks what was new on this visit.
  if (current === 1) await markSeen(actor.userId);
  const publicKey = pushPublicKey();

  return (
    <>
      <PageHeader title={t("title")} intro={t("adminIntro")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <NotificationList items={items} seenAt={seenAt} viewerId={actor.userId} admin />
          <Pagination page={current} pages={pages} href={(target) => `/admin/notifications?page=${target}`} />
        </div>
        <div className="h-fit">
          {publicKey ? (
            <PhoneAlerts publicKey={publicKey} />
          ) : (
            <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{tPwa("notSetUp")}</p>
          )}
        </div>
      </div>
    </>
  );
}
