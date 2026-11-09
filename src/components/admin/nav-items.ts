import type { Messages } from "next-intl";
import type { NavIconName } from "@/components/shell/nav-icons";

// The platform admin's menu: one line per page, added with the page itself, in the order the side menu shows them.
// Every page is for platform admins only (the layout checks it once), so the lines carry no permissions.

type AdminNavGroupName = keyof Messages["admin"]["nav"]["groups"];
type AdminNavLabel = Exclude<keyof Messages["admin"]["nav"], "groups">;

interface AdminPage {
  group: AdminNavGroupName;
  /** Its address under /admin; empty for the overview. */
  path: string;
  icon: NavIconName;
  /** Also in the bar at the bottom of a phone. */
  tab?: boolean;
}

const ADMIN_PAGES = {
  overview: { group: "platform", path: "", icon: "overview", tab: true },
  hosts: { group: "platform", path: "hosts", icon: "hosts", tab: true },
  users: { group: "platform", path: "users", icon: "people" },
  money: { group: "money", path: "money", icon: "money", tab: true },
  categories: { group: "content", path: "categories", icon: "categories" },
  appearance: { group: "content", path: "appearance", icon: "appearance" },
  health: { group: "operations", path: "health", icon: "health", tab: true },
  profile: { group: "account", path: "profile", icon: "profile" },
} as const satisfies Partial<Record<AdminNavLabel, AdminPage>>;

type AdminPageName = keyof typeof ADMIN_PAGES;

const GROUP_ORDER: readonly AdminNavGroupName[] = ["platform", "money", "content", "operations", "account"];

export interface AdminNavGroup {
  group: AdminNavGroupName;
  items: Array<{ href: string; label: AdminPageName; icon: NavIconName; tab?: boolean; end?: boolean }>;
}

/** The admin menu, grouped, with each label as its message key for the layout to translate. */
export function adminNav(): AdminNavGroup[] {
  const names = Object.keys(ADMIN_PAGES) as AdminPageName[];
  return GROUP_ORDER.map((group) => ({
    group,
    items: names
      .map((name) => ({ name, page: ADMIN_PAGES[name] as AdminPage }))
      .filter(({ page }) => page.group === group)
      .map(({ name, page }) => ({
        href: page.path ? `/admin/${page.path}` : "/admin",
        label: name,
        icon: page.icon,
        tab: page.tab,
        // The overview is lit only on its own address, not on every page under it.
        end: page.path === "",
      })),
  })).filter(({ items }) => items.length > 0);
}
