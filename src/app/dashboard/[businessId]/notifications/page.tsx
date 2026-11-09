import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { Pagination } from "@/components/ui/pagination";
import { NotificationList, PhoneAlerts } from "@/modules/notifications";
import { getBusinessNotifications, markSeen, pushPublicKey } from "@/modules/notifications/server";
import { requirePageTenant } from "@/server/http/session";

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ page?: string }>;
};

/** What happened in this business that this member should know, page by page, and phone alerts for it. */
export default async function DashboardNotificationsPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  const page = Number((await searchParams).page ?? 1) || 1;
  const [t, tPwa, { items, seenAt, page: current, pages }] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("pwa"),
    getBusinessNotifications(ctx, page),
  ]);
  // Read once shown: the list still marks what was new on this visit.
  if (current === 1) await markSeen(ctx.userId);
  const publicKey = pushPublicKey();

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <NotificationList items={items} seenAt={seenAt} viewerId={ctx.userId} />
          <Pagination
            page={current}
            pages={pages}
            href={(target) => `/dashboard/${businessId}/notifications?page=${target}`}
          />
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
