import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  test as base,
  expect,
  type Page,
} from "@playwright/test";
import { confirmEmail } from "./mailbox";

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

// The demo places' stock photos come from images.unsplash.com. On a slow connection they take longer than the image
// optimizer waits (it answers 500), and a place's page never finishes loading, so the tests would measure the photo
// site, not our app. The browser answers them with one small picture instead; our own uploaded photos still go the
// whole way through.
const STOCK_PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4sP8EAATJAkrt3ZsDAAAAAElFTkSuQmCC",
  "base64",
);

function isStockPhoto(url: URL): boolean {
  const source = url.pathname === "/_next/image" ? url.searchParams.get("url") : url.href;
  return source?.startsWith("https://images.unsplash.com/") ?? false;
}

async function withoutStockPhotos(context: BrowserContext): Promise<BrowserContext> {
  await context.route(isStockPhoto, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: STOCK_PHOTO }),
  );
  return context;
}

/** Playwright's `test`, with the stock photos answered in the browser. Every spec imports this one. */
export const test = base.extend({
  context: async ({ context }, provide) => {
    await provide(await withoutStockPhotos(context));
  },
});

/** A second window (another person, or a visitor), with the stock photos answered like the first. */
export async function newContext(browser: Browser, options?: BrowserContextOptions) {
  return withoutStockPhotos(await browser.newContext(options));
}

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
function freshStay(nights = 2) {
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

/** The open date picker's button for a day, when the month it is in is showing. */
function dayButton(page: Page, isoDate: string) {
  return page
    .getByRole("dialog", { name: "Choose your dates" })
    .getByRole("button", { name: new RegExp(`^${dayName(isoDate)}`) });
}

async function isFree(page: Page, isoDate: string): Promise<boolean> {
  const button = dayButton(page, isoDate);
  return (await button.isVisible()) && (await button.getAttribute("aria-disabled")) !== "true";
}

/**
 * Picks a stay whose nights are all free in the open date picker, and returns it. The browser tests share one
 * database that fills up run after run, so instead of trusting a random stay to be free, this tries a few, earliest
 * first, and keeps the first one the calendar offers.
 */
export async function pickFreeStay(page: Page, nights = 2): Promise<{ checkIn: string; checkOut: string }> {
  const dialog = page.getByRole("dialog", { name: "Choose your dates" });
  const candidates = Array.from({ length: 15 }, () => freshStay(nights)).sort((a, b) =>
    a.checkIn.localeCompare(b.checkIn),
  );
  for (const stay of candidates) {
    for (let month = 0; month < 13 && !(await dayButton(page, stay.checkIn).isVisible()); month += 1) {
      await dialog.getByRole("button", { name: "Next month" }).click();
    }
    const nightsOfStay = Array.from({ length: nights }, (_, night) => isoDaysAfter(stay.checkIn, night));
    const free = await Promise.all(nightsOfStay.map((night) => isFree(page, night)));
    if (!free.every(Boolean)) continue;
    await dayButton(page, stay.checkIn).click();
    for (let month = 0; month < 2 && !(await dayButton(page, stay.checkOut).isVisible()); month += 1) {
      await dialog.getByRole("button", { name: "Next month" }).click();
    }
    await dayButton(page, stay.checkOut).click();
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog).toBeHidden();
    return stay;
  }
  throw new Error("The calendar offered none of the stays tried: the browser-test database may need a reset");
}

function isoDaysAfter(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The page is no wider than the window: nothing makes the visitor scroll sideways. It looks again for a moment,
 * because while the theme changes the page briefly counts the scrollbar as width, then settles.
 */
export async function expectNoSidewaysScroll(page: Page) {
  await expect
    .poll(
      () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      { message: `${page.url()} scrolls sideways`, timeout: 3_000 },
    )
    .toBeLessThanOrEqual(0);
}

/**
 * Collects what went wrong in the browser while a test ran: uncaught errors and our server's 5xx answers. A refusal
 * the test asked for is checked by the test itself, so 4xx answers are left out.
 */
export function watchForErrors(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== new URL(page.url()).origin || response.status() < 500) return;
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

/** An email address no account has yet. */
export function newEmail(name: string): string {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.test`;
}

/** Makes a new account through the sign-up page, and leaves it signed in. */
export async function signUp(page: Page, name: string): Promise<string> {
  const email = newEmail(name.split(" ")[0]?.toLowerCase() ?? "guest");
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  // No one is signed in before confirming their email: the account waits for its link.
  await expect(page.getByText("Check your inbox")).toBeVisible({ timeout: 15_000 });
  await confirmEmail(email);
  await signIn(page, email);
  return email;
}

/**
 * Signs in on the sign-in page. Many tests sign in at once from the same address, so the sign-in limit (a few tries
 * in ten seconds) can refuse one: it waits and tries again, as a person would.
 */
export async function signIn(page: Page, email: string) {
  await expect(async () => {
    if (!new URL(page.url()).pathname.startsWith("/sign-in")) await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 5_000 });
  }).toPass({ intervals: [3_000, 5_000, 10_000], timeout: 45_000 });
}

/**
 * A new host with a new place on the Free plan, made the way a person does it (sign up, then "Create your
 * workspace"); returns the place's dashboard address. For tests that add what cannot be taken back, such as rooms.
 */
export async function newHost(page: Page, name: string): Promise<string> {
  await signUp(page, name);
  await page.goto("/host");
  const create = page.getByRole("region", { name: "Create your workspace" });
  await create
    .getByLabel("Name of your place")
    .fill(`${name.split(" ")[0] ?? "New"}'s guesthouse ${Date.now() % 100_000}`);
  await create.getByLabel("Town or area").fill("Batroun");
  await create.getByRole("button", { name: "Create workspace" }).click();
  // A new place on Free opens on its guided setup; the place's home is the address above it.
  await expect(page).toHaveURL(/\/dashboard\/[^/]+\/setup$/, { timeout: 20_000 });
  return new URL(page.url()).pathname.replace(/\/setup$/, "");
}

/**
 * At a place that takes online payment: picks free nights, books them (`link` is the place page's booking link:
 * "Book and pay", or "Request to book" where the host answers first) and pays with Whish's simulator. Returns the
 * booking page's address.
 */
export async function bookAndPayWithWhish(
  page: Page,
  slug: string,
  guestName: string,
  link = "Book and pay",
) {
  await page.goto(`/p/${slug}`);
  await page
    .getByRole("button", { name: /Check-in/ })
    .first()
    .click();
  await pickFreeStay(page);
  await page.getByRole("link", { name: link }).click();
  await page.getByLabel("Full name").fill(guestName);
  await page.getByLabel("Mobile number").fill("+96171123456");
  await page.getByRole("button", { name: "Book and pay" }).click();
  await page.getByRole("button", { name: "Pay with Whish" }).click();
  await expect(page).toHaveURL(/\/whish-simulator\/pay\//);
  await page.getByLabel("Whish phone number").fill("96170123456");
  await page.getByLabel("Code sent to your Whish app").fill("111111");
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page).toHaveURL(/\/b\//, { timeout: 20_000 });
  return page.url();
}
