import { describe, expect, it } from "vitest";
import { DASHBOARD_PAGES, dashboardNav } from "@/components/dashboard/nav-items";
import type { Permission } from "@/config/permissions";
import type { TenantContext } from "@/server/auth/tenant-context";

function member(permissions: Permission[]): TenantContext {
  return {
    userId: "u1",
    businessId: "b1",
    membershipId: "m1",
    isOwner: false,
    permissions: new Set(permissions),
    channel: "web",
  };
}

describe("dashboardNav", () => {
  it("lists each page the member may open under its group, with its address in this business", () => {
    expect(dashboardNav(member(["bookings.read"]))).toEqual([
      {
        group: "today",
        items: [{ href: "/dashboard/b1", label: "overview", icon: "overview", tab: true, end: true }],
      },
      {
        group: "bookings",
        items: [
          { href: "/dashboard/b1/bookings", label: "bookings", icon: "bookings", tab: true, end: false },
        ],
      },
      {
        group: "business",
        items: [{ href: "/dashboard/b1/profile", label: "profile", icon: "profile", end: false }],
      },
    ]);
  });

  it("hides a page the member's role does not open, and the group left empty, but always shows their own profile", () => {
    expect(dashboardNav(member(["guests.contact"]))).toEqual([
      {
        group: "business",
        items: [{ href: "/dashboard/b1/profile", label: "profile", icon: "profile", end: false }],
      },
    ]);
  });

  it("reads the same permissions the page itself checks", () => {
    for (const permission of DASHBOARD_PAGES.bookings.anyOf) {
      const labels = dashboardNav(member([permission])).flatMap(({ items }) =>
        items.map((item) => item.label),
      );
      expect(labels).toContain("bookings");
    }
    for (const permission of DASHBOARD_PAGES.team.anyOf) {
      const labels = dashboardNav(member([permission])).flatMap(({ items }) =>
        items.map((item) => item.label),
      );
      expect(labels).toContain("team");
    }
    for (const permission of DASHBOARD_PAGES.overview.anyOf) {
      const labels = dashboardNav(member([permission])).flatMap(({ items }) =>
        items.map((item) => item.label),
      );
      expect(labels).toContain("overview");
    }
  });
});
