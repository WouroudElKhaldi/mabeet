import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/server/http/session";
import { AppFrame } from "./app-frame";
import type { NavGroup } from "./nav";

/**
 * The frame of the host dashboard and the admin area: the side menu on big screens, the top bar, and on phones the bar
 * at the bottom with a drawer for the rest. The page that uses it passes the menu (`nav`), already filtered by what the
 * member may open and already translated, and puts its page inside.
 *
 *   <AppShell nav={nav}>{children}</AppShell>
 */
export async function AppShell({
  nav,
  area = "host",
  adminVisiting = false,
  children,
}: {
  nav: NavGroup[];
  area?: "host" | "admin";
  /** A platform admin looking at someone else's business: the top bar says so. */
  adminVisiting?: boolean;
  children: ReactNode;
}) {
  const [t, user] = await Promise.all([getTranslations("shell"), getCurrentUser()]);
  return (
    <AppFrame
      nav={nav}
      areaLabel={area === "admin" ? t("adminArea") : t("hostArea")}
      badge={adminVisiting ? t("adminBadge") : undefined}
      viewSiteHref="/"
      userName={user?.name ?? t("account")}
    >
      {children}
    </AppFrame>
  );
}
