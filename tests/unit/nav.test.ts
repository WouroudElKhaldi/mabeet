import { describe, expect, it } from "vitest";
import { currentNavItem, isActiveNav, tabItems } from "@/components/shell/nav";
import type { NavGroup } from "@/components/shell/nav";

const base = "/dashboard/b1";
const nav: NavGroup[] = [
  {
    label: "Today",
    items: [{ href: base, label: "Overview", icon: "overview", end: true, tab: true }],
  },
  {
    label: "Listings",
    items: [
      { href: `${base}/place`, label: "Place", icon: "place" },
      { href: `${base}/rooms`, label: "Rooms", icon: "rooms", tab: true },
    ],
  },
  {
    label: "Bookings",
    items: [{ href: `${base}/bookings`, label: "Bookings", icon: "bookings", tab: true }],
  },
];

describe("isActiveNav", () => {
  it("is on for the item's own page and for the pages under it", () => {
    expect(isActiveNav(`${base}/rooms`, { href: `${base}/rooms` })).toBe(true);
    expect(isActiveNav(`${base}/rooms/r1`, { href: `${base}/rooms` })).toBe(true);
  });

  it("is not on for a page that only starts with the same letters", () => {
    expect(isActiveNav(`${base}/rooms-archive`, { href: `${base}/rooms` })).toBe(false);
    expect(isActiveNav(`${base}/room`, { href: `${base}/rooms` })).toBe(false);
  });

  it("ignores a slash at the end, in the address or in the item", () => {
    expect(isActiveNav(`${base}/rooms/`, { href: `${base}/rooms` })).toBe(true);
    expect(isActiveNav(`${base}/rooms`, { href: `${base}/rooms/` })).toBe(true);
  });

  it("keeps a menu's home page from being on for every page under it (end)", () => {
    expect(isActiveNav(`${base}/rooms`, { href: base })).toBe(true);
    expect(isActiveNav(`${base}/rooms`, { href: base, end: true })).toBe(false);
    expect(isActiveNav(base, { href: base, end: true })).toBe(true);
  });
});

describe("currentNavItem", () => {
  it("finds the item for the page being shown, and for a page under it", () => {
    expect(currentNavItem(nav, `${base}/bookings`)?.label).toBe("Bookings");
    expect(currentNavItem(nav, `${base}/rooms/r1/photos`)?.label).toBe("Rooms");
    expect(currentNavItem(nav, base)?.label).toBe("Overview");
  });

  it("takes the most specific item when several match", () => {
    const nested: NavGroup[] = [
      {
        label: "x",
        items: [
          { href: "/dashboard/b1/team", label: "Team", icon: "team" },
          { href: "/dashboard/b1/team/roles", label: "Roles", icon: "team" },
        ],
      },
    ];
    expect(currentNavItem(nested, "/dashboard/b1/team/roles/r2")?.label).toBe("Roles");
    expect(currentNavItem(nested, "/dashboard/b1/team")?.label).toBe("Team");
  });

  it("finds nothing for a page that is not in the menu", () => {
    expect(currentNavItem(nav, "/somewhere/else")).toBeNull();
    expect(currentNavItem([], base)).toBeNull();
  });
});

describe("tabItems", () => {
  it("takes the items marked for the bar at the bottom of a phone, in menu order", () => {
    expect(tabItems(nav).map((item) => item.label)).toEqual(["Overview", "Rooms", "Bookings"]);
  });

  it("holds at most four, because the bar also needs room for More", () => {
    const many: NavGroup[] = [
      {
        label: "x",
        items: ["a", "b", "c", "d", "e", "f"].map((name) => ({
          href: `/${name}`,
          label: name,
          icon: "rooms" as const,
          tab: true,
        })),
      },
    ];
    expect(tabItems(many).map((item) => item.label)).toEqual(["a", "b", "c", "d"]);
  });
});
