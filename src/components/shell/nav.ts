import type { NavIconName } from "./nav-icons";

// The menu of the dashboard and the admin area, as the page that builds it hands it to `AppShell`: already filtered by
// what the member may open, and already translated. The shell knows nothing about permissions.

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  /** Also in the bar at the bottom of a phone (the first four marked); everything else is behind "More". */
  tab?: boolean;
  /** The item is on only for exactly this address, not for the pages under it (a menu's home page). */
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** The most items the bar at the bottom of a phone can hold next to "More". */
export const MAX_TABS = 4;

function clean(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isActiveNav(pathname: string, { href, end }: Pick<NavItem, "href" | "end">): boolean {
  const here = clean(pathname);
  const target = clean(href);
  return here === target || (!end && here.startsWith(`${target}/`));
}

/** The item for the page being shown: the most specific one that matches, so "Rooms" wins over a "Place" above it. */
export function currentNavItem(nav: NavGroup[], pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of nav.flatMap((group) => group.items)) {
    if (isActiveNav(pathname, item) && (!best || clean(item.href).length > clean(best.href).length))
      best = item;
  }
  return best;
}

export function tabItems(nav: NavGroup[]): NavItem[] {
  return nav
    .flatMap((group) => group.items)
    .filter((item) => item.tab)
    .slice(0, MAX_TABS);
}
