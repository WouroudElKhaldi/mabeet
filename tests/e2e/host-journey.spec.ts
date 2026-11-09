import { expect, type Page, test } from "@playwright/test";
import {
  expectNoSidewaysScroll,
  newEmail,
  newHost,
  pickFreeStay,
  placeDashboard,
  PLACES,
  signedIn,
  watchForErrors,
} from "./helpers";

// What a host does with their place, beyond looking: answering a request with no, cancelling a stay, adding and
// changing a room, its prices and photos, closing and reopening nights, switching how guests book, inviting someone
// to the team, and what a front-desk member may and may not open. Each test puts back what it changed.

const place = PLACES.offline;

let problems: string[] = [];
let base = "";

test.use({ storageState: signedIn("host") });

test.beforeEach(({ page }) => {
  problems = watchForErrors(page);
});

test.afterEach(() => {
  expect(problems).toEqual([]);
});

/** A guest, in their own browser, asks for a stay at the place; returns their booking page. */
async function guestRequests(page: Page, guestName: string): Promise<string> {
  await page.goto(`/p/${place.slug}`);
  await page
    .getByRole("button", { name: /Check-in/ })
    .first()
    .click();
  await pickFreeStay(page);
  await page.getByRole("link", { name: "Request to book" }).click();
  await page.getByLabel("Full name").fill(guestName);
  await page.getByLabel("Mobile number").fill("+96171123456");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page).toHaveURL(/\/b\//);
  return page.url();
}

test("bookings: declining a request, and cancelling a confirmed stay", async ({ page, browser }) => {
  base ||= await placeDashboard(page, place.name);
  const guest = await browser.newContext({ storageState: signedIn("guest") });
  const guestPage = await guest.newPage();
  const declined = `Hadi Mansour ${Date.now() % 100_000}`;
  const cancelled = `Yara Azar ${Date.now() % 100_000}`;
  const declinedLink = await guestRequests(guestPage, declined);
  const cancelledLink = await guestRequests(guestPage, cancelled);

  await page.goto(`${base}/bookings`);
  const request = page.getByRole("listitem").filter({ hasText: declined });
  await request.getByRole("button", { name: "Decline" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Decline" }).click();
  await expect(request).toBeHidden();
  await guestPage.goto(declinedLink);
  await expect(guestPage.getByRole("heading", { level: 1 })).toContainText("couldn't take this booking");

  const toConfirm = page.getByRole("listitem").filter({ hasText: cancelled });
  await toConfirm.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(toConfirm).toBeHidden();
  await page.getByRole("link", { name: "Upcoming" }).click();
  const stay = page.getByRole("listitem").filter({ hasText: cancelled });
  await stay.getByRole("button", { name: /Cancel/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Cancel/ })
    .last()
    .click();
  await expect(stay.getByText("Cancelled")).toBeVisible();
  await guestPage.goto(cancelledLink);
  await expect(guestPage.getByRole("heading", { level: 1 })).toContainText(/cancelled/i);

  await guest.close();
});

test("rooms: add a room, change its price, take it off the site, and the plan's limit", async ({
  browser,
}) => {
  // A new place of its own: rooms are never deleted, so the demo places would fill up run after run.
  const context = await browser.newContext();
  const page = await context.newPage();
  const ownProblems = watchForErrors(page);
  const dashboard = await newHost(page, "Karim Daher");
  await page.goto(`${dashboard}/rooms`);
  const add = page.getByRole("region", { name: "Add a room" });

  async function addRoom(name: string, rate: string) {
    await add.getByRole("textbox", { name: "Room name" }).fill(name);
    await add.getByRole("spinbutton", { name: "Nightly rate" }).fill(rate);
    await add.getByRole("button", { name: "Add room" }).click();
  }

  await add.getByText("Wi-Fi", { exact: true }).click();
  await addRoom("Cedar loft", "95");
  const room = page.getByRole("group").filter({ hasText: "Cedar loft" });
  await expect(room).toBeVisible();
  await room.click();
  await room.getByRole("spinbutton", { name: "Nightly rate" }).fill("110");
  await room.getByRole("button", { name: /Save/ }).first().click();
  await page.reload();
  const saved = page.getByRole("group").filter({ hasText: "Cedar loft" });
  await saved.click();
  await expect(saved.getByRole("spinbutton", { name: "Nightly rate" })).toHaveValue("110");

  // Not bookable any more: it says so, and guests are not offered it.
  await saved.getByText("Bookable by guests", { exact: true }).click();
  await saved.getByRole("button", { name: /Save/ }).first().click();
  await page.reload();
  await expect(page.getByRole("group").filter({ hasText: "Cedar loft" })).toContainText("Hidden");

  // The Free plan holds three rooms; a fourth is refused with the reason and a way to upgrade.
  await addRoom("Garden room", "80");
  await expect(page.getByRole("group").filter({ hasText: "Garden room" })).toBeVisible();
  await addRoom("Terrace room", "85");
  await expect(page.getByRole("group").filter({ hasText: "Terrace room" })).toBeVisible();
  await addRoom("Attic room", "70");
  await expect(add.getByRole("alert")).toHaveText("Your plan allows up to 3 rooms. Upgrade to add more.");
  await expectNoSidewaysScroll(page);

  expect(ownProblems).toEqual([]);
  await context.close();
});

test("your place: adding a photo, then deleting it", async ({ page }) => {
  base ||= await placeDashboard(page, place.name);
  await page.goto(`${base}/place`);
  await expect(page.getByRole("button", { name: "Add photos" })).toBeVisible();
  const deletes = page.getByRole("button", { name: "Delete photo" });
  const before = await deletes.count();
  // "Add photos" opens the computer's file picker; the test hands the picker's input a photo directly.
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "terrace.png", mimeType: "image/png", buffer: await samplePhoto(page) });
  await expect(deletes).toHaveCount(before + 1, { timeout: 30_000 });

  await deletes.last().click();
  const confirm = page.getByRole("dialog");
  if (await confirm.isVisible()) await confirm.getByRole("button", { name: /Delete/ }).click();
  await expect(deletes).toHaveCount(before);
});

/** A real photo, drawn by the browser itself: 1200 by 800 pixels of colour. */
async function samplePhoto(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D canvas in this browser");
    const gradient = context.createLinearGradient(0, 0, 1200, 800);
    gradient.addColorStop(0, "#7a9e7e");
    gradient.addColorStop(1, "#e8d9b5");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1200, 800);
    return canvas.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

test("settings: switching how guests book, with the payment policy, and back", async ({ browser }) => {
  // A place of its own, so a run stopped half-way never leaves a demo place in another mode.
  const context = await browser.newContext();
  const page = await context.newPage();
  const ownProblems = watchForErrors(page);
  const dashboard = await newHost(page, "Maya Sfeir");
  await page.goto(`${dashboard}/settings`);
  const modes = page.getByRole("group", { name: "How guests book and pay" });
  const save = page.getByRole("button", { name: "Save settings" });

  // An online mode asks for the payment policy first: until it is accepted, the page will not save.
  await modes.getByText("Automatic", { exact: true }).click();
  await expect(save).toBeDisabled();
  await page.getByRole("checkbox", { name: /I accept the payment policy/ }).check();
  await save.click();
  await expect(save).toBeEnabled();
  await page.reload();
  await expect(modes.getByRole("radio", { name: /^Automatic/ })).toBeChecked();
  await expect(page.getByText(/You accepted the payment policy on/)).toBeVisible();

  await modes.getByText("Offline", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "How guests pay you directly" })).toBeVisible();
  await save.click();
  await expect(save).toBeEnabled();
  await page.reload();
  await expect(modes.getByRole("radio", { name: /^Offline/ })).toBeChecked();

  expect(ownProblems).toEqual([]);
  await context.close();
});

test("team: inviting someone, then taking the invitation back", async ({ page }) => {
  base ||= await placeDashboard(page, place.name);
  await page.goto(`${base}/team`);
  const invite = page.getByRole("region", { name: "Invite someone to the team" });
  const name = `Tarek Saliba ${Date.now() % 100_000}`;
  await invite.getByRole("textbox", { name: "Full name" }).fill(name);
  await invite.getByRole("textbox", { name: "Email" }).fill(newEmail("tarek"));
  await invite.getByRole("textbox", { name: "Phone" }).fill("+96171555123");
  await invite.getByRole("button", { name: "Send invitation" }).click();
  const invitation = page
    .getByRole("region", { name: "Invitations" })
    .getByRole("listitem")
    .filter({ hasText: name });
  await expect(invitation).toBeVisible();
  await invitation.getByRole("button", { name: /Revoke|Cancel|Withdraw/ }).click();
  const confirm = page.getByRole("dialog");
  if (await confirm.isVisible())
    await confirm
      .getByRole("button", { name: /Revoke|Cancel|Withdraw/ })
      .last()
      .click();
  await expect(invitation).toContainText("Cancelled");
});

test.describe("a front-desk member", () => {
  test.use({ storageState: signedIn("staff") });

  test("sees bookings and the calendar, never the money or the team", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard\/[^/]+/);
    const dashboard = new URL(page.url()).pathname.split("/").slice(0, 3).join("/");
    await page.goto(`${dashboard}/bookings`);
    await expect(page.getByRole("heading", { level: 1, name: "Bookings" })).toBeVisible();
    await page.goto(`${dashboard}/calendar`);
    await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
    for (const path of ["payouts", "billing", "team", "settings"]) {
      await page.goto(`${dashboard}/${path}`);
      await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
        /Payouts|Plan and billing|Team|Settings/,
      );
    }
  });
});

test("calendar: closing nights for real, and opening them again", async ({ browser }) => {
  // A place of its own with one room, so closed nights never block another test's booking.
  const context = await browser.newContext();
  const page = await context.newPage();
  const ownProblems = watchForErrors(page);
  const dashboard = await newHost(page, "Rana Khalil");
  await page.goto(`${dashboard}/rooms`);
  const add = page.getByRole("region", { name: "Add a room" });
  await add.getByRole("textbox", { name: "Room name" }).fill("Olive room");
  await add.getByRole("spinbutton", { name: "Nightly rate" }).fill("90");
  await add.getByRole("button", { name: "Add room" }).click();
  await expect(page.getByRole("group").filter({ hasText: "Olive room" })).toBeVisible();

  await page.goto(`${dashboard}/calendar`);
  const days = page.getByRole("button", { name: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, / });
  await page.getByRole("button", { name: "Close dates" }).click();
  await days.nth(24).click();
  await page.getByRole("button", { name: "Close these dates" }).click();
  await expect(page.getByRole("button", { name: "Close these dates" })).toBeHidden();
  const closed = page.getByRole("button", { name: "Closed · Olive room" }).first();
  await expect(closed).toBeVisible();

  await closed.click();
  await page.getByRole("button", { name: "Reopen these dates" }).click();
  await page
    .getByRole("dialog", { name: "Reopen these nights?" })
    .getByRole("button", { name: "Reopen" })
    .click();
  await expect(page.getByRole("button", { name: "Closed · Olive room" })).toHaveCount(0);

  expect(ownProblems).toEqual([]);
  await context.close();
});
