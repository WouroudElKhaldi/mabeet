import type { Messages } from "next-intl";
import type { NavIconName } from "@/components/shell/nav-icons";
import type { Permission } from "@/config/permissions";
import { can, type TenantContext } from "@/server/auth/tenant-context";

// The host dashboard's menu: one line per page, added with the page itself, in the order the side menu shows them.
// Each page opens with requirePageAccess(businessId, DASHBOARD_PAGES.<page>.anyOf), so the menu and the page read the
// same permissions, and a member is never offered a page that answers 404.

type NavGroupName = keyof Messages["dashboard"]["navGroups"];
type NavLabel = keyof Messages["dashboard"]["nav"];

interface DashboardPage {
  group: NavGroupName;
  /** Its address under /dashboard/[businessId]; empty for the place's home page. */
  path: string;
  icon: NavIconName;
  /** The member needs one of these to open it. */
  anyOf: readonly Permission[];
  /** Also in the bar at the bottom of a phone. */
  tab?: boolean;
}

export const DASHBOARD_PAGES = {
  overview: {
    group: "today",
    path: "",
    icon: "overview",
    anyOf: ["bookings.read", "analytics.read"],
    tab: true,
  },
  bookings: { group: "bookings", path: "bookings", icon: "bookings", anyOf: ["bookings.read"], tab: true },
  calendar: { group: "bookings", path: "calendar", icon: "calendar", anyOf: ["calendar.read"], tab: true },
  channels: { group: "bookings", path: "channels", icon: "channels", anyOf: ["feeds.manage"] },
  place: { group: "listings", path: "place", icon: "place", anyOf: ["settings.manage"] },
  rooms: { group: "listings", path: "rooms", icon: "rooms", anyOf: ["rooms.read"], tab: true },
  settings: { group: "business", path: "settings", icon: "settings", anyOf: ["settings.manage"] },
  analytics: { group: "money", path: "analytics", icon: "analytics", anyOf: ["analytics.read"] },
  team: { group: "team", path: "team", icon: "team", anyOf: ["team.manage", "roles.manage"] },
  keys: { group: "ai", path: "keys", icon: "keys", anyOf: ["ai.use"] },
} as const satisfies Partial<Record<NavLabel, DashboardPage>>;

type DashboardPageName = keyof typeof DASHBOARD_PAGES;

const GROUP_ORDER: readonly NavGroupName[] = [
  "today",
  "ai",
  "bookings",
  "listings",
  "money",
  "team",
  "business",
];

export interface DashboardNavGroup {
  group: NavGroupName;
  items: Array<{ href: string; label: NavLabel; icon: NavIconName; tab?: boolean; end?: boolean }>;
}

/** The menu this member may see, grouped, with each label as its message key for the layout to translate. */
export function dashboardNav(ctx: TenantContext): DashboardNavGroup[] {
  const names = Object.keys(DASHBOARD_PAGES) as DashboardPageName[];
  return GROUP_ORDER.map((group) => ({
    group,
    items: names
      .map((name) => ({ name, page: DASHBOARD_PAGES[name] as DashboardPage }))
      .filter(({ page }) => page.group === group && page.anyOf.some((permission) => can(ctx, permission)))
      .map(({ name, page }) => ({
        href: page.path ? `/dashboard/${ctx.businessId}/${page.path}` : `/dashboard/${ctx.businessId}`,
        label: name,
        icon: page.icon,
        tab: page.tab,
        // The home page is lit only on its own address, not on every page under it.
        end: page.path === "",
      })),
  })).filter(({ items }) => items.length > 0);
}
