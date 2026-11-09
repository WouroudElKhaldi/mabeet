import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { adminNav } from "@/components/admin/nav-items";
import { AppShell } from "@/components/shell/app-shell";
import { requirePageAdmin } from "@/server/http/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: { template: `%s · ${t("title")}`, default: t("title") }, robots: { index: false } };
}

/** The platform admin area. Anyone else gets the 404 page, so it never even shows it exists. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [, t] = await Promise.all([requirePageAdmin(), getTranslations("admin.nav")]);
  const nav = adminNav().map(({ group, items }) => ({
    label: t(`groups.${group}`),
    items: items.map((item) => ({ ...item, label: t(item.label) })),
  }));
  return (
    <AppShell nav={nav} area="admin">
      {children}
    </AppShell>
  );
}
