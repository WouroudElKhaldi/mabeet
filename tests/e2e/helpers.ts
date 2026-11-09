import { expect, type Page } from "@playwright/test";

// What the browser tests share: the demo accounts the seed makes (prisma/seed.ts), where each one's sign-in is kept
// between tests, and the checks every page must pass.

export const PASSWORD = process.env.SEED_PASSWORD || "demo-password-123";

export const ACCOUNTS = {
  host: "host@mabeet.test",
  staff: "staff@mabeet.test",
  guest: "guest@mabeet.test",
  admin: "admin@mabeet.test",
} as const;

export type AccountName = keyof typeof ACCOUNTS;

/** Where the sign-in step keeps an account's cookies, for tests that start signed in (`test.use({ storageState })`). */
export const signedIn = (account: AccountName) => `test-results/.auth/${account}.json`;

/** The demo places, by booking mode (prisma/seed.ts). */
export const PLACES = {
  approval: { name: "Dar Al Sindiyan (demo)", slug: "dar-al-sindiyan-demo" },
  automatic: { name: "Bayt El Bahr (demo)", slug: "bayt-el-bahr-demo" },
  offline: { name: "Beit Ghazir (demo)", slug: "beit-ghazir-demo" },
  wholePlace: { name: "Kroum Cabin (demo)", slug: "kroum-cabin-demo" },
} as const;

/** A day as an ISO date, `days` after today (UTC, like every night). */
function isoDaysFromToday(days: number): string {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days))
    .toISOString()
    .slice(0, 10);
}

/**
 * A stay far enough ahead, and spread enough, that runs reusing the same database rarely ask for the same nights; a
 * test that needs free nights still checks what the calendar offers.
 */
export function freshStay(nights = 2) {
  const start = 40 + Math.floor(Math.random() * 280);
  return { checkIn: isoDaysFromToday(start), checkOut: isoDaysFromToday(start + nights) };
}

/** The name the date picker gives a day's button, as a screen reader reads it ("Friday, December 18, 2026"). */
export function dayName(isoDate: string, locale = "en"): string {
  return new Intl.DateTimeFormat(`${locale}-u-ca-gregory-nu-latn`, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Picks check-in and check-out in the open date picker, moving month by month until each day shows. */
export async function pickStay(page: Page, stay: { checkIn: string; checkOut: string }) {
  const dialog = page.getByRole("dialog", { name: "Choose your dates" });
  for (const day of [stay.checkIn, stay.checkOut]) {
    const button = dialog.getByRole("button", { name: new RegExp(`^${dayName(day)}`) });
    for (let month = 0; month < 13 && !(await button.isVisible()); month += 1) {
      await dialog.getByRole("button", { name: "Next month" }).click();
    }
    await button.click();
  }
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog).toBeHidden();
}

/** The page is no wider than the phone: nothing makes the visitor scroll sideways. */
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${page.url()} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}

/**
 * Collects what went wrong in the browser while a test ran: uncaught errors and our server's 5xx answers. A refusal
 * the test asked for is checked by the test itself, so 4xx answers are left out, and so is the image optimizer timing
 * out on a demo place's stock photo, which is the photo site being slow, not our app.
 */
export function watchForErrors(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== new URL(page.url()).origin || response.status() < 500) return;
    if (response.status() === 504 && url.pathname === "/_next/image") return;
    problems.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
  });
  return problems;
}

/** A link whose name starts with this text, as a pattern safe for names with brackets ("Beit Ghazir (demo)"). */
export function startingWith(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

/** The address of a place's dashboard, read from the owner's list of places. */
export async function placeDashboard(page: Page, placeName: string): Promise<string> {
  await page.goto("/dashboard");
  const href = await page
    .getByRole("link", { name: startingWith(placeName) })
    .first()
    .getAttribute("href");
  if (!href) throw new Error(`The owner's list of places has no link to ${placeName}`);
  return href;
}
