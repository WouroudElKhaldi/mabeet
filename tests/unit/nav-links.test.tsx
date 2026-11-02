import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavLinks } from "@/components/shell/nav-links";
import type { NavGroup } from "@/components/shell/nav";

const current = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => current.path }));

// The menu as the page builds it, rendered: which page a screen reader is told is the current one.

const nav: NavGroup[] = [
  { label: "Today", items: [{ href: "/dashboard/b1", label: "Overview", icon: "overview", end: true }] },
  {
    label: "Listings",
    items: [
      { href: "/dashboard/b1/rooms", label: "Rooms", icon: "rooms" },
      { href: "/dashboard/b1/place", label: "Place", icon: "place" },
    ],
  },
];

function render() {
  return renderToStaticMarkup(<NavLinks nav={nav} label="Main pages" />);
}

function linkFor(html: string, label: string) {
  return new RegExp(`<a [^>]*>(?:(?!</a>).)*${label}(?:(?!</a>).)*</a>`).exec(html)?.[0] ?? "";
}

describe("NavLinks", () => {
  beforeEach(() => {
    current.path = "/";
  });

  it("marks only the page being shown as current", () => {
    current.path = "/dashboard/b1/rooms";
    const html = render();
    expect(linkFor(html, "Rooms")).toContain('aria-current="page"');
    expect(linkFor(html, "Place")).not.toContain("aria-current");
    expect(linkFor(html, "Overview")).not.toContain("aria-current");
  });

  it("keeps the home page of the menu from being marked on every page under it", () => {
    current.path = "/dashboard/b1";
    expect(linkFor(render(), "Overview")).toContain('aria-current="page"');
    current.path = "/dashboard/b1/place/photos";
    const html = render();
    expect(linkFor(html, "Overview")).not.toContain("aria-current");
    expect(linkFor(html, "Place")).toContain('aria-current="page"');
  });

  it("marks nothing for a page that is not in the menu", () => {
    current.path = "/elsewhere";
    expect(render()).not.toContain("aria-current");
  });

  it("names the list for a screen reader, shows each group under its title and links every page", () => {
    const html = render();
    expect(html).toContain('aria-label="Main pages"');
    expect(html).toContain("Today");
    expect(html).toContain("Listings");
    for (const href of ["/dashboard/b1", "/dashboard/b1/rooms", "/dashboard/b1/place"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("hides the icons from a screen reader, which reads the label", () => {
    expect(render().match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(3);
  });
});
