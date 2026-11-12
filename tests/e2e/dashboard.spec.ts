import { expect } from "@playwright/test";
import { expectNoSidewaysScroll, placeDashboard, PLACES, signedIn, test, watchForErrors } from "./helpers";

// The owner's dashboard, control by control, on a phone: the shell (menu, More, bell, theme, language) and every
// page's buttons, tabs, filters and forms. Saves write back what was there, so the demo place stays as it was.

test.use({ storageState: signedIn("host"), permissions: ["clipboard-read", "clipboard-write"] });

let base = "";
let problems: string[] = [];

test.beforeEach(async ({ page }) => {
  problems = watchForErrors(page);
  base ||= await placeDashboard(page, PLACES.approval.name);
});

test.afterEach(() => {
  expect(problems).toEqual([]);
});

test("the shell: side menu, More, bell, dark mode and language", { tag: "@phone" }, async ({ page }) => {
  await page.goto(base);

  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu.getByRole("link", { name: "Settings" })).toBeVisible();
  await menu.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Channels" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Channels" })).toBeVisible();

  await page.getByRole("button", { name: "Notifications" }).click();
  await page.getByRole("link", { name: "View all" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");

  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "اللغة" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).not.toHaveURL(/\/notifications$/);
});

test("bookings: every tab", async ({ page }) => {
  await page.goto(`${base}/bookings`);
  for (const tab of ["Upcoming", "Past", "All", "Requests"]) {
    await page.getByRole("navigation", { name: "Show" }).getByRole("link", { name: tab }).click();
    await expect(
      page.getByRole("navigation", { name: "Show" }).getByRole("link", { name: tab }),
    ).toHaveAttribute("aria-current", /page|true/);
  }
});

test("calendar: views, months, a day, the filters and closing dates", async ({ page }) => {
  await page.goto(`${base}/calendar`);
  // Each view stays inside the phone: the rooms view scrolls inside its card, never the page.
  for (const view of ["Week", "Rooms", "Month"]) {
    await page.getByRole("tab", { name: view }).click();
    await expect(page.getByRole("tab", { name: view })).toHaveAttribute("aria-selected", "true");
    await expectNoSidewaysScroll(page);
  }
  const month = page
    .getByText(
      /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/,
    )
    .first();
  const before = await month.textContent();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(month).not.toHaveText(before ?? "");
  await page.getByRole("button", { name: "Previous month" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(month).toHaveText(before ?? "");

  const days = page.getByRole("button", { name: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, / });
  await days.nth(20).click();
  await expect(days.nth(20)).toHaveAttribute("aria-pressed", "true");

  const direct = page.getByRole("group", { name: "Show" }).getByRole("button", { name: "Direct booking" });
  await direct.click();
  await expect(direct).toHaveAttribute("aria-pressed", "false");
  await direct.click();
  await expect(direct).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("combobox", { name: "Room" }).selectOption({ label: "Arched room" });
  await page.getByRole("combobox", { name: "Room" }).selectOption({ label: "All rooms" });

  // Closing dates starts on the calendar itself: the last night is the next day clicked. Cancel keeps them open.
  await page.getByRole("button", { name: "Close dates" }).click();
  await expect(page.getByText("Now click the last night to close.")).toBeVisible();
  await days.nth(30).click();
  const form = page.getByRole("dialog");
  await expect(form.getByRole("button", { name: "Close these dates" })).toBeEnabled();
  await form.getByRole("button", { name: "Cancel" }).click();
  await expect(form).toBeHidden();
});

test("channels: copy a room's link, and a calendar link to add", async ({ page }) => {
  await page.goto(`${base}/channels`);
  const room = page.getByRole("region", { name: "Arched room" });
  await room.getByRole("button", { name: "Copy" }).click();
  await expect(room.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/\/api\/ical\/.+\.ics$/);

  await room.getByRole("button", { name: "Add calendar" }).click();
  const form = page.getByRole("dialog", { name: "Add a calendar to Arched room" });
  const add = form.getByRole("button", { name: "Add calendar" });
  await expect(add).toBeDisabled();
  await form.getByRole("combobox", { name: "Platform" }).selectOption({ label: "Booking.com" });
  await form
    .getByRole("textbox", { name: "Calendar link (.ics)" })
    .fill("https://admin.booking.com/calendar.ics");
  await expect(add).toBeEnabled();
  await form.getByRole("textbox", { name: "Calendar link (.ics)" }).fill("");
  await expect(add).toBeDisabled();
});

test("your place: its page link and saving the profile", async ({ page }) => {
  await page.goto(`${base}/place`);
  await expect(page.getByRole("link", { name: "View my page" })).toHaveAttribute(
    "href",
    new RegExp(`/p/${PLACES.approval.slug}`),
  );
  const profile = page
    .getByRole("region")
    .filter({ has: page.getByRole("heading", { level: 2, name: "Profile" }) });
  await profile.getByRole("button", { name: "Edit" }).click();
  const form = page.getByRole("dialog");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();
});

test("rooms: both rooms and the form to add one", async ({ page }) => {
  await page.goto(`${base}/rooms`);
  await expect(
    page.getByRole("table", { name: "Rooms" }).getByRole("row", { name: /Arched room/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add a room" }).click();
  const add = page.getByRole("dialog");
  await add.getByRole("button", { name: "Add room" }).click();
  // Nothing typed: the browser stops at the first required field instead of sending.
  await expect(add.getByRole("textbox", { name: "Room name" })).toBeFocused();
});

test("settings: saving what is there", async ({ page }) => {
  await page.goto(`${base}/settings`);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});

test("profile: details, a wrong phone, the host profile and a wrong password", async ({ page }) => {
  await page.goto(`${base}/profile`);
  const name = page.getByRole("textbox", { name: "Full name" });
  await expect(name).toHaveValue("Demo Host");
  await page.getByRole("textbox", { name: "Phone" }).first().fill("71 123");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Write the number in international format")).toBeVisible();
  await page.getByRole("textbox", { name: "Phone" }).first().fill("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.").first()).toBeVisible();

  const host = page.getByRole("region", { name: "My host profile" });
  // The choices are chips: the visible label is what a person taps.
  await host.getByText("WhatsApp only", { exact: true }).click();
  await expect(host.getByRole("radio", { name: "WhatsApp only" })).toBeChecked();
  await host.getByText("WhatsApp and Contact host", { exact: true }).click();
  await expect(host.getByRole("radio", { name: "WhatsApp and Contact host" })).toBeChecked();
  await host.getByRole("button", { name: "Save profile" }).click();
  await expect(host.getByText("Saved.")).toBeVisible();

  await page.getByRole("textbox", { name: "Current password" }).fill("not-my-password");
  await page.getByRole("textbox", { name: "New password" }).fill("another-password-123");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your current password isn't right.")).toBeVisible();
});

test("analytics: the periods and all places", async ({ page }) => {
  await page.goto(`${base}/analytics`);
  for (const period of ["Last 30 days", "Last 12 months", "Last 90 days"]) {
    await page.getByRole("link", { name: period }).click();
    await expect(page.getByRole("region", { name: "Nights sold by month" })).toBeVisible();
  }
  await page.getByRole("combobox", { name: "Places" }).selectOption({ label: "All my places" });
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page).toHaveURL(/scope=all/);
});

test("payouts: the balances and asking without an amount", async ({ page }) => {
  await page.goto(`${base}/payouts`);
  await expect(page.getByRole("button", { name: "Ask for a payout" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Online payments" })).toBeVisible();
});

test("billing: what the place uses, and paying a month with Whish", async ({ page }) => {
  await page.goto(`${base}/billing`);
  await expect(page.getByRole("heading", { level: 1, name: "Plan and billing" })).toBeVisible();
  await expect(page.getByText(/You are on (Free|Pro|Business)/)).toBeVisible();
  const usage = page.getByRole("region", { name: "What your place uses" });
  for (const label of ["Rooms", "Team members"]) {
    await expect(usage.getByText(label, { exact: true })).toBeVisible();
  }
  // Card payments are off in the browser tests, so the page says so and offers Whish.
  await expect(page.getByText("Paying by card isn't set up yet.")).toBeVisible();

  // Whish's page (its simulator): going back changes nothing.
  await page.getByRole("button", { name: "Pay a month with Whish" }).first().click();
  await expect(page).toHaveURL(/\/whish-simulator\/pay\//);
  await page.getByRole("link", { name: "Cancel and go back" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Plan and billing" })).toBeVisible();

  // Paying: the month is added at once and the page says thank you.
  await page.getByRole("button", { name: "Pay a month with Whish" }).first().click();
  await page.getByLabel("Whish phone number").fill("96170123456");
  await page.getByLabel("Code sent to your Whish app").fill("111111");
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Thank you!" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/You are on Pro · renews or ends on/)).toBeVisible();
});

test("team: the members, the invitation form and a new role", async ({ page }) => {
  await page.goto(`${base}/team`);
  await expect(page.getByRole("table").getByRole("combobox", { name: "Role" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Invite someone" }).click();
  const invite = page.getByRole("dialog");
  await invite.getByRole("button", { name: "Send invitation" }).click();
  await expect(invite.getByRole("textbox", { name: "Full name" })).toBeFocused();
  await invite.getByRole("button", { name: "Close" }).click();

  const roleName = `Night desk ${Date.now() % 100_000}`;
  await page.getByRole("button", { name: "New role" }).click();
  const newRole = page.getByRole("dialog");
  await newRole.getByRole("textbox", { name: "Role name" }).fill(roleName);
  await newRole.getByRole("checkbox", { name: /^See bookings/ }).check();
  await newRole.getByRole("button", { name: "Create role" }).click();
  await expect(page.getByRole("main").getByText(roleName, { exact: true }).first()).toBeVisible();
});

test("AI keys: create one, see it once, and revoke it", async ({ page }) => {
  await page.goto(`${base}/keys`);
  const keyName = `Laptop ${Date.now() % 100_000}`;
  await page.getByRole("textbox", { name: "Key name" }).fill(keyName);
  await page.getByRole("combobox", { name: "Expires after" }).selectOption({ label: "30 days" });
  await page.getByRole("button", { name: "Create key" }).click();
  await expect(page.getByText("Copy this key now.")).toBeVisible();
  await page.getByRole("button", { name: "I've copied it" }).click();

  const key = page.getByRole("listitem").filter({ hasText: keyName });
  await key.getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Revoke" }).click();
  await expect(key).toBeHidden();
});
