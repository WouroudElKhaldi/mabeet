import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { dashboardNav } from "@/components/dashboard/nav-items";
import { AppShell } from "@/components/shell/app-shell";
import { requirePageTenant } from "@/server/http/session";

type LayoutProps = { children: ReactNode; params: Promise<{ businessId: string }> };

/** The host dashboard's frame, for members only (anyone else gets the 404 page), with the menu their role opens. */
export default async function DashboardLayout({ children, params }: LayoutProps) {
  const { businessId } = await params;
  const [ctx, t] = await Promise.all([requirePageTenant(businessId), getTranslations("dashboard")]);
  const nav = dashboardNav(ctx).map(({ group, items }) => ({
    label: t(`navGroups.${group}`),
    items: items.map((item) => ({ ...item, label: t(`nav.${item.label}`) })),
  }));
  return (
    <AppShell nav={nav} adminVisiting={ctx.platformAdmin === true}>
      {children}
    </AppShell>
  );
}
