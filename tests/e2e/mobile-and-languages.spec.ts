import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import {
  type AccountName,
  expectNoSidewaysScroll,
  placeDashboard,
  PLACES,
  signedIn,
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
  `/p/${PLACES.approval.slug}`,
  `/p/${PLACES.wholePlace.slug}`,
  `/p/${PLACES.offline.slug}/contact`,
  "/sign-in",
  "/sign-up",
  "/forgot-password",
];

const GUEST_PAGES = ["/account", "/account/privacy", "/account/notifications"];

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
  "/notifications",
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/hosts",
  "/admin/users",
  "/admin/money",
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
      const context = await browser.newContext();
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
      { who: "guest", title: "a guest's pages", pages: async () => GUEST_PAGES },
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
      { who: "admin", title: "every admin page", pages: async () => ADMIN_PAGES },
    ];

    for (const { who, title, pages } of signedInPages) {
      test(title, async ({ browser }) => {
        const context = await browser.newContext({ storageState: signedIn(who) });
        await inLanguage(context, locale);
        const page = await context.newPage();
        for (const path of await pages(page)) await checkPage(page, path, dir);
        await context.close();
      });
    }
  });
}
