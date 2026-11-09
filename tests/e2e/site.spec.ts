import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, PLACES, startingWith, watchForErrors } from "./helpers";

// The public site, control by control, for a visitor on a phone who is not signed in: searching, the categories and
// filters, a place's page, the sign-in and sign-up forms, and every link in the footer.

let problems: string[] = [];
test.beforeEach(({ page }) => {
  problems = watchForErrors(page);
});
test.afterEach(() => {
  expect(problems).toEqual([]);
});

test("home: search by area, the categories, filters and the place cards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("search").getByRole("textbox", { name: "Where" }).fill("Chouf");
  await page.getByRole("search").getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search/);
  await expect(page.getByRole("article").filter({ hasText: PLACES.approval.name })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: PLACES.offline.name })).toBeHidden();

  await page.goto("/");
  await page
    .getByRole("group", { name: "Type of place or activity" })
    .getByRole("link", { name: "Cabin" })
    .click();
  await expect(page.getByRole("article").filter({ hasText: PLACES.wholePlace.name })).toBeVisible();

  await page.getByRole("button", { name: "Filters" }).click();
  const filters = page.getByRole("dialog");
  await expect(filters).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filters).toBeHidden();

  await page.goto("/");
  await page
    .getByRole("link", { name: startingWith(PLACES.offline.name) })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name: PLACES.offline.name })).toBeVisible();
});

test("search: guests and dates in the search bar", async ({ page }) => {
  await page.goto("/search");
  const search = page.getByRole("search");
  await search.getByRole("button", { name: /^Guests/ }).click();
  await search.getByRole("button", { name: "More guests" }).click();
  await expect(search.getByRole("button", { name: /^Guests/ })).toContainText("2 guests");

  await page
    .getByRole("search")
    .getByRole("button", { name: /^Check-in/ })
    .click();
  const dates = page.getByRole("dialog", { name: "Choose your dates" });
  await dates.getByRole("button", { name: "Next month" }).click();
  await dates.getByRole("button", { name: "Previous month" }).click();
  // Nothing picked yet, so there is nothing to clear.
  await expect(dates.getByRole("button", { name: "Clear" })).toHaveAttribute("aria-disabled", "true");
  await dates.getByRole("button", { name: "Close" }).click();
  await expect(dates).toBeHidden();
});

test("a place: photos, guests, the host and booking needs an account", async ({ page }) => {
  await page.goto(`/p/${PLACES.approval.slug}`);
  await page.getByRole("button", { name: "Show all photos" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  const box = page.getByRole("complementary");
  await box.getByRole("combobox", { name: "Room" }).selectOption({ label: "Family loft" });
  await box.getByRole("button", { name: "More guests" }).click();
  await expect(box.getByRole("status")).toContainText("3 guests");
  await box.getByRole("button", { name: "Fewer guests" }).click();
  await expect(box.getByRole("status")).toContainText("2 guests");

  const host = page.getByRole("region", { name: "Meet your host" });
  await expect(host.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me\/961/);
  await host.getByRole("link", { name: "Contact host" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: `Contact ${PLACES.approval.name}` }),
  ).toBeVisible();

  // Booking needs an account: the book page sends a visitor to sign in, and back afterwards.
  await page.goto(`/p/${PLACES.approval.slug}/book?checkIn=2027-03-01&checkOut=2027-03-03`);
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await expectNoSidewaysScroll(page);
});

test("sign in and sign up: what a wrong entry says", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("host@mabeet.test");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/That email and password don't match|Too many attempts/)).toBeVisible();

  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Create your account" }).click();
  await expect(page).toHaveURL(/\/sign-up/);
  await page.getByLabel("Full name").fill("Lina Haddad");
  await page.getByLabel("Email").fill("lina@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  // Too short: the browser stops it before anything is sent.
  await expect(page).toHaveURL(/\/sign-up/);
});

test("the header: dark mode and language, for a visitor", async ({ page }) => {
  await page.goto("/");
  // On a phone they sit in the site's menu.
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitemradio", { name: "اللبنانية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar-LB");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expectNoSidewaysScroll(page);
});

test("every footer link opens", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  const links = await footer
    .getByRole("link")
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href") ?? ""));
  expect(links.length).toBeGreaterThan(5);
  for (const href of new Set(links)) {
    const response = await page.goto(href);
    expect(response?.status(), href).toBeLessThan(400);
    // "Your trips" and "Host dashboard" send a visitor to sign in once the page has started: let that finish first.
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 }).first(), href).toBeVisible();
  }
});
