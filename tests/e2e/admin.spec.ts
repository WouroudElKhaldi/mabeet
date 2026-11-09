import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, PLACES, signedIn, startingWith, watchForErrors } from "./helpers";

// The platform admin's pages, control by control, on a phone. Whatever a test changes (a business suspended, the
// site's colours, a category) it puts back, so the demo looks the same after the run.

test.use({ storageState: signedIn("admin") });

let problems: string[] = [];
test.beforeEach(({ page }) => {
  problems = watchForErrors(page);
});
test.afterEach(() => {
  expect(problems).toEqual([]);
});

test("overview: the numbers and each 'needs your attention' line", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("region", { name: "Platform" })).toBeVisible();
  const attention = page.getByRole("region", { name: "Needs your attention" });
  await attention.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/admin\/money/);
  await page.goto("/admin");
  await attention.getByRole("link").last().click();
  await expect(page).toHaveURL(/\/admin\/health/);
  await page.goto("/admin");
  await page
    .getByRole("region", { name: "Newest businesses" })
    .getByRole("link", { name: "See all" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Hosts" })).toBeVisible();
});

test("the phone menu: the tabs and More", async ({ page }) => {
  await page.goto("/admin");
  const tabs = page.getByRole("navigation", { name: "Main pages" });
  for (const [tab, title] of [
    ["Hosts", "Hosts"],
    ["Money", "Money"],
    ["Health", "Health"],
    ["Overview", "Overview"],
  ]) {
    await tabs.getByRole("link", { name: tab }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  }
  for (const [item, title] of [
    ["Users", "Users"],
    ["Categories", "Categories"],
    ["Appearance", "Appearance"],
    ["My profile", "My profile"],
  ]) {
    await tabs.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog").getByRole("link", { name: item }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  }
});

test("hosts: a host's page, opening a business, and suspending then reactivating it", async ({
  page,
  browser,
}) => {
  await page.goto("/admin/hosts");
  const host = page.getByRole("region", { name: "Demo Host" });
  await host.getByRole("link", { name: "Host profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Demo Host" })).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.goto("/admin/hosts");
  const business = host.getByRole("listitem").filter({ hasText: PLACES.wholePlace.name });
  const reactivate = business.getByRole("button", { name: "Reactivate" });
  const visitor = await browser.newContext();
  const guestPage = await visitor.newPage();
  const placeTitle = guestPage.getByRole("heading", { level: 1, name: PLACES.wholePlace.name });
  // A run stopped half-way can leave it suspended: start from listed.
  if (await reactivate.isVisible()) await reactivate.click();
  try {
    await business.getByRole("button", { name: "Suspend" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Suspend" }).click();
    await expect(reactivate).toBeVisible();
    // While suspended, guests find no page for it.
    await guestPage.goto(`/p/${PLACES.wholePlace.slug}`);
    await expect(guestPage.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(placeTitle).toBeHidden();
  } finally {
    // Back as it was, even when a check above failed, so the other tests find the place listed.
    if (await reactivate.isVisible()) await reactivate.click();
  }
  await expect(business.getByRole("button", { name: "Suspend" })).toBeVisible();
  await guestPage.goto(`/p/${PLACES.wholePlace.slug}`);
  await expect(placeTitle).toBeVisible();
  await visitor.close();

  await business.getByRole("link", { name: "Open dashboard" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
});

test("categories: add one, rename it, and delete it", async ({ page }) => {
  await page.goto("/admin/categories");
  const slug = `rooftop-${Date.now() % 100_000}`;
  await page.getByRole("textbox", { name: "Slug" }).fill(slug);
  await page.getByRole("combobox", { name: "Type" }).selectOption({ label: "Experiences" });
  // The form to add one is the last on the page; it needs both names.
  await page.getByRole("textbox", { name: "English name" }).last().fill("Rooftop");
  await page.getByRole("textbox", { name: "Arabic name" }).last().fill("سطح");
  await page.getByRole("button", { name: "Add category" }).click();

  const row = page.getByRole("listitem").filter({ has: page.getByText(slug, { exact: true }) });
  await expect(row).toBeVisible();
  await row.getByRole("textbox", { name: "English name" }).fill("Rooftop dinners");
  await row.getByRole("textbox", { name: "Arabic name" }).fill("عشاء على السطح");
  await row.getByRole("button", { name: "Save" }).click();
  await page.reload();
  await expect(row.getByRole("textbox", { name: "English name" })).toHaveValue("Rooftop dinners");

  await row.getByRole("button", { name: "Delete category" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Delete/ })
    .click();
  await expect(row).toBeHidden();
});

test("appearance: a palette changes the whole site, and Cedar comes back", async ({ page }) => {
  await page.goto("/admin/appearance");
  await page.getByText("Byblos", { exact: true }).click();
  await expect(page.getByRole("radio", { name: startingWith("Byblos") })).toBeChecked();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "byblos");

  await page.goto("/admin/appearance");
  await page.getByText("Cedar", { exact: true }).click();
  await expect(page.getByRole("radio", { name: startingWith("Cedar") })).toBeChecked();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "cedar");
});

test("money, users and health show their sections", async ({ page }) => {
  await page.goto("/admin/money");
  for (const section of [
    "Earned from plans",
    "Payouts to send",
    "What Mabeet owes hosts",
    "Refunds to send by hand",
    "Plan revenue by month",
    "Recent payouts",
  ]) {
    await expect(page.getByRole("region", { name: section })).toBeVisible();
  }
  await page.goto("/admin/users");
  await expect(page.getByRole("region", { name: "Newest people" }).getByText("Demo Guest")).toBeVisible();
  await page.goto("/admin/health");
  await expect(page.getByRole("region", { name: "Calendar sync" })).toBeVisible();
});

test("notifications: the bell and the full list", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.getByRole("link", { name: "View all" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
});

test("profile: saving the admin's own details, and a wrong password", async ({ page }) => {
  await page.goto("/admin/profile");
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("Demo Admin");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByRole("textbox", { name: "Current password" }).fill("not-my-password");
  await page.getByRole("textbox", { name: "New password" }).fill("another-password-123");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your current password isn't right.")).toBeVisible();
});
