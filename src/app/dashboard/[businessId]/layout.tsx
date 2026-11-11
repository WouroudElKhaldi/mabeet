import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { dashboardNav } from "@/components/dashboard/nav-items";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationBell } from "@/modules/notifications";
import { countBusinessUnread } from "@/modules/notifications/server";
import { listWorkspaces } from "@/modules/team/server";
import { requirePageTenant } from "@/server/http/session";

type LayoutProps = { children: ReactNode; params: Promise<{ businessId: string }> };

/** The host dashboard's frame, for members only (anyone else gets the 404 page), with the menu their role opens. */
export default async function DashboardLayout({ children, params }: LayoutProps) {
  const { businessId } = await params;
  const [ctx, t] = await Promise.all([requirePageTenant(businessId), getTranslations("dashboard")]);
  const [unread, memberships] = await Promise.all([countBusinessUnread(ctx), listWorkspaces(ctx.userId)]);
  const places = memberships.map(({ business }) => ({ id: business.id, name: business.name }));
  // A platform admin looking at someone else's place is not a member of it, so has nothing to switch to.
  const current = places.find((place) => place.id === businessId);
  const nav = dashboardNav(ctx).map(({ group, items }) => ({
    label: t(`navGroups.${group}`),
    items: items.map((item) => ({ ...item, label: t(`nav.${item.label}`) })),
  }));
  return (
    <AppShell
      nav={nav}
      adminVisiting={ctx.platformAdmin === true}
      places={current ? { current, all: places } : undefined}
      bell={
        <NotificationBell
          feedEndpoint={`/api/workspaces/${businessId}/notifications`}
          viewAllHref={`/dashboard/${businessId}/notifications`}
          unread={unread}
          viewerId={ctx.userId}
        />
      }
    >
      {children}
    </AppShell>
  );
}
