import { type BrowserContext, expect, type Page } from "@playwright/test";
import {
  expectNoSidewaysScroll,
  newContext,
  placeDashboard,
  PLACES,
  signedIn,
  test,
  type AccountName,
  watchForErrors,
} from "./helpers";

// Every page, at 390px, in English, Arabic and Lebanese Arabic: it opens without an error, shows its title, is laid
// out in the language's direction, and never makes the visitor scroll sideways.

const LANGUAGES = [
  { locale: "en", dir: "ltr" },
  { locale: "ar", dir: "rtl" },
  { locale: "ar-LB", dir: "rtl" },
] as const;

const PUBLIC_PAGES = [
  "/",
  "/search",
  "/pricing",
  "/about",
  "/contact",
  "/privacy",
  "/host",
  "/assistant",
  "/offline",
  `/p/${PLACES.approval.slug}`,
  `/p/${PLACES.approval.slug}/photos`,
  `/p/${PLACES.wholePlace.slug}`,
  `/p/${PLACES.offline.slug}/contact`,
  "/sign-in",
  "/sign-up",
  "/forgot-password",
];

/** A stay a month from now, two nights, as the book page reads it from its link. */
function bookLink(slug: string) {
  const day = (fromToday: number) => new Date(Date.now() + fromToday * 86_400_000).toISOString().slice(0, 10);
  return `/p/${slug}/book?checkIn=${day(30)}&checkOut=${day(32)}`;
}

const GUEST_PAGES = [
  "/account",
  "/account/activity",
  "/account/favorites",
  "/account/privacy",
  "/account/notifications",
  bookLink(PLACES.approval.slug),
];

const DASHBOARD_PAGES = [
  "",
  "/bookings",
  "/calendar",
  "/channels",
  "/place",
  "/rooms",
  "/settings",
  "/profile",
  "/analytics",
  "/payouts",
  "/billing",
  "/team",
  "/keys",
  "/reviews",
  "/notifications",
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/hosts",
  "/admin/users",
  "/admin/money",
  "/admin/money/requests",
  "/admin/money/refunds",
  "/admin/money/balances",
  "/admin/money/payouts",
  "/admin/categories",
  "/admin/partners",
  "/admin/appearance",
  "/admin/health",
  "/admin/notifications",
  "/admin/profile",
];

async function inLanguage(context: BrowserContext, locale: string) {
  await context.addCookies([{ name: "locale", value: locale, url: "http://localhost:3100" }]);
}

/** Opens a page and checks what every page must do. */
async function checkPage(page: Page, path: string, dir: string) {
  const problems = watchForErrors(page);
  const response = await page.goto(path);
  expect(response?.status(), `${path} answered ${response?.status()}`).toBeLessThan(400);
  await expect(page.locator("html")).toHaveAttribute("dir", dir);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  expect(problems, path).toEqual([]);
}

for (const { locale, dir } of LANGUAGES) {
  test.describe(`in ${locale}`, () => {
    test("public pages", async ({ browser }) => {
      const context = await newContext(browser);
      await inLanguage(context, locale);
      const page = await context.newPage();
      for (const path of PUBLIC_PAGES) await checkPage(page, path, dir);
      await context.close();
    });

    const signedInPages: Array<{
      who: AccountName;
      title: string;
      pages: (page: Page) => Promise<string[]>;
    }> = [
      {
        who: "guest",
        title: "a guest's pages, and the page of one of their bookings",
        pages: async (page) => {
          // The demo guest's trips (prisma/seed.ts) each link to their booking's private page.
          await page.goto("/account");
          const booking = await page.locator('a[href^="/b/"]').first().getAttribute("href");
          if (!booking) throw new Error("The demo guest has no booking to open");
          return [...GUEST_PAGES, booking];
        },
      },
      {
        who: "host",
        title: "every dashboard page, for the owner",
        pages: async (page) => {
          const base = await placeDashboard(page, PLACES.approval.name);
          return ["/dashboard", ...DASHBOARD_PAGES.map((path) => `${base}${path}`)];
        },
      },
      {
        who: "staff",
        title: "the dashboard pages the front desk may open",
        pages: async (page) => {
          // Someone who works in one place only is taken straight to it.
          await page.goto("/dashboard").catch(() => undefined);
          await page.waitForURL(/\/dashboard\/[^/]+$/);
          const base = new URL(page.url()).pathname;
          return [base, `${base}/bookings`, `${base}/calendar`, `${base}/profile`, `${base}/notifications`];
        },
      },
      {
        who: "admin",
        title: "every admin page, and one host's",
        pages: async (page) => {
          await page.goto("/admin/hosts");
          const host = await page.locator('a[href^="/admin/hosts/"]').first().getAttribute("href");
          if (!host) throw new Error("The admin's list of hosts has no host to open");
          return [...ADMIN_PAGES, host];
        },
      },
    ];

    for (const { who, title, pages } of signedInPages) {
      test(title, async ({ browser }) => {
        const context = await newContext(browser, { storageState: signedIn(who) });
        await inLanguage(context, locale);
        const page = await context.newPage();
        for (const path of await pages(page)) await checkPage(page, path, dir);
        await context.close();
      });
    }
  });
}
