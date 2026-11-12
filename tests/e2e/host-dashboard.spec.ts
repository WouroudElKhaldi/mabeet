import { expect } from "@playwright/test";
import { expectNoSidewaysScroll, placeDashboard, PLACES, signedIn, test, watchForErrors } from "./helpers";

// The owner's dashboard in a window as big as the screen, as a host at their desk sees it: the side menu reaches every
// page, each page fills the width without scrolling sideways, and the top bar's bell, appearance and language work.
// The page-by-page controls are in dashboard.spec.ts and host-journey.spec.ts, which run at this size too.

test.use({ storageState: signedIn("host") });

let problems: string[] = [];
let base = "";
test.beforeEach(async ({ page }) => {
  problems = watchForErrors(page);
  base = await placeDashboard(page, PLACES.approval.name);
});
test.afterEach(() => {
  expect(problems).toEqual([]);
});

/** Every page an owner has, in the side menu's order, with where it lives. */
const PAGES = [
  { label: "Today", path: "" },
  { label: "Claude & ChatGPT (MCP)", path: "/keys" },
  { label: "Bookings", path: "/bookings" },
  { label: "Calendar", path: "/calendar" },
  { label: "Channels", path: "/channels" },
  { label: "Your place", path: "/place" },
  { label: "Rooms", path: "/rooms" },
  { label: "Reviews", path: "/reviews" },
  { label: "Analytics", path: "/analytics" },
  { label: "Payouts", path: "/payouts" },
  { label: "Billing", path: "/billing" },
  { label: "Team", path: "/team" },
  { label: "Settings", path: "/settings" },
  { label: "My profile", path: "/profile" },
];

test(
  "the side menu opens every page, and each one fills the screen",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(base);
    const menu = page.getByRole("complementary").getByRole("navigation", { name: "Main pages" });
    await expect(menu).toBeVisible();
    // On a big screen the phone's menu button and bottom bar are not there.
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();

    for (const { label, path } of PAGES) {
      await menu.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${base}${path}$`));
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(menu.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      // The top bar names the page the host is on.
      await expect(page.getByRole("banner").getByText(label, { exact: true })).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
  },
);

test(
  "the place switcher atop the menu: to another place, all places, and adding one",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(`${base}/calendar`);
    const side = page.getByRole("complementary").filter({ has: page.getByRole("navigation") });
    const switcher = side.locator("details");
    await expect(switcher.locator("summary")).toContainText(PLACES.approval.name);

    // Every other place is one click away, and choosing one opens its dashboard with the switcher on it.
    await switcher.locator("summary").click();
    const others = switcher.getByRole("list", { name: "Your other places" });
    for (const other of [PLACES.automatic, PLACES.offline, PLACES.wholePlace]) {
      await expect(others.getByRole("link", { name: other.name })).toBeVisible();
    }
    await expect(others.getByRole("link", { name: PLACES.approval.name })).toHaveCount(0);
    await switcher.getByRole("link", { name: PLACES.automatic.name }).click();
    await expect(page).not.toHaveURL(new RegExp(`${base}`));
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(switcher.locator("summary")).toContainText(PLACES.automatic.name);
    // It folds again once a place is chosen.
    await expect(switcher.getByRole("link", { name: "All my places" })).toBeHidden();

    await switcher.locator("summary").click();
    // Adding a place opens a pop-up here, never the sign-up page for new hosts.
    await expect(switcher.getByRole("button", { name: "Add a place" })).toBeVisible();
    await switcher.getByRole("link", { name: "All my places" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "All my places" })).toBeVisible();
    await expectNoSidewaysScroll(page);
  },
);

test("a new place starts its guided setup: one question a screen, then save and exit", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Add a place" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name of your place").fill(`Beit Setup ${Date.now() % 100_000}`);
  await dialog.getByRole("button", { name: "Add the place" }).click();

  await expect(page).toHaveURL(/\/dashboard\/[^/]+\/setup$/);
  const progress = page.getByRole("progressbar", { name: "Setup progress" });
  await expect(page.getByText("Step 1 of 8")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "How do guests book your place?" })).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/step=profile$/);
  await expect(progress).toHaveAttribute("aria-valuenow", "2");
  await page.getByLabel("Area").fill("Batroun");
  await page.getByRole("button", { name: "Save and exit" }).click();

  // Back on the place's home, where the checklist leads into the setup again.
  await expect(page).toHaveURL(/\/dashboard\/[^/]+$/);
  const checklist = page.getByRole("region", { name: "Get your place ready for guests" });
  await expect(checklist.getByRole("link", { name: "Guided setup" })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("the top bar: the bell, the site, dark mode and language", { tag: "@desktop" }, async ({ page }) => {
  await page.goto(`${base}/calendar`);
  const bar = page.getByRole("banner");

  // The bell says how many are new ("6 new notifications"), or just "Notifications".
  await bar.getByRole("button", { name: /notifications/i }).click();
  await page.getByRole("link", { name: "View all" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  // Back returns to the page the host came from, not to the place's home.
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/calendar$`));

  await bar.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await expectNoSidewaysScroll(page);
  await bar.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");

  await bar.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  // In Arabic the side menu sits on the right of the screen.
  // The calendar has a side column of its own; the menu is the one holding the navigation.
  const side = await page
    .getByRole("complementary")
    .filter({ has: page.getByRole("navigation") })
    .boundingBox();
  const width = page.viewportSize()?.width ?? (await page.evaluate(() => window.innerWidth));
  expect((side?.x ?? 0) + (side?.width ?? 0)).toBeGreaterThan(width / 2);
  await expectNoSidewaysScroll(page);
  await bar.getByRole("button", { name: "اللغة" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

  const site = page.waitForURL((url) => url.pathname === "/");
  await bar.getByRole("link", { name: "View site" }).click();
  await site;
});

test(
  "the calendar's month, closing dates and the bookings table use the whole width",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(`${base}/calendar`);
    await page.getByRole("tab", { name: "Month" }).click();
    await expectNoSidewaysScroll(page);
    const main = await page.getByRole("main").boundingBox();
    const width = await page.evaluate(() => window.innerWidth);
    // The page is laid out beside the side menu, not squeezed into a phone's column.
    expect(main?.width ?? 0).toBeGreaterThan(Math.min(width - 300, 900));

    // Closing dates: each field is wide enough to show the room's name and the whole date.
    const hint = page.getByText("Now click the last night to close.");
    await expect(async () => {
      await page.getByRole("button", { name: "Close dates" }).click();
      await expect(hint).toBeVisible({ timeout: 2_000 });
    }).toPass();
    const days = page.getByRole("button", { name: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, / });
    await days.nth(25).click();
    const form = page.getByRole("dialog");
    const fields = {
      Room: form.getByRole("combobox", { name: "Room" }),
      From: form.getByRole("textbox", { name: "From" }),
      "Last night": form.getByRole("textbox", { name: "Last night" }),
      Note: form.getByRole("textbox", { name: "Note" }),
    };
    for (const [name, field] of Object.entries(fields)) {
      const box = await field.boundingBox();
      expect(box?.width ?? 0, `the ${name} field's width`).toBeGreaterThanOrEqual(150);
    }
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(form).toBeHidden();

    await page.goto(`${base}/bookings`);
    const show = page.getByRole("navigation", { name: "Show" });
    for (const tab of ["Upcoming", "Past", "All", "Requests"]) {
      await show.getByRole("link", { name: tab }).click();
      await expect(show.getByRole("link", { name: tab })).toHaveAttribute("aria-current", /page|true/);
      await expectNoSidewaysScroll(page);
    }
  },
);
