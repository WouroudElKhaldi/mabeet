import { expect, type Page, test } from "@playwright/test";
import {
  expectNoSidewaysScroll,
  newEmail,
  newHost,
  PASSWORD,
  pickFreeStay,
  PLACES,
  signedIn,
  signUp,
  watchForErrors,
} from "./helpers";

// A guest's whole journey, page by page, on a phone: making an account, signing out and back in, asking for a new
// password, booking and paying at a place that confirms at once, finding the stay in My trips and cancelling it for
// a full refund, writing to a host and to us, the account's notifications and privacy pages, and leaving for good.

let problems: string[] = [];

test.beforeEach(({ page }) => {
  problems = watchForErrors(page);
});

test.afterEach(() => {
  expect(problems).toEqual([]);
});

test("a new account: sign up, sign out, sign back in, and a forgotten password", async ({ page }) => {
  const name = "Lea Nassar";
  const email = await signUp(page, name);
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: `Hello, ${name}` })).toBeVisible();
  await expect(page.getByText("No trips yet")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).not.toHaveURL(/\/account/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Hello, ${name}` })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).not.toHaveURL(/\/account/);
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(email);

  // A reset link that is not ours, or no longer valid, says so instead of changing anything.
  await page.goto("/reset-password?token=not-a-real-token");
  await page.getByLabel("Password", { exact: true }).fill("another-password-456");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

/** Picks `stay` on the place's page and goes on to its booking form. */
async function startBooking(page: Page, slug: string, next: string) {
  await page.goto(`/p/${slug}`);
  await page
    .getByRole("button", { name: /Check-in/ })
    .first()
    .click();
  await pickFreeStay(page);
  await page.getByRole("link", { name: next }).click();
  await expect(page.getByRole("heading", { name: "Book your stay" })).toBeVisible();
  await expectNoSidewaysScroll(page);
}

test("a place that confirms at once: pay with Whish, find it in trips, cancel for a full refund", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: signedIn("guest") });
  const page = await context.newPage();
  const pageProblems = watchForErrors(page);
  const place = PLACES.automatic;
  await startBooking(page, place.slug, "Book and pay");
  await page.getByLabel("Full name").fill("Sami Haddad");
  await page.getByLabel("Mobile number").fill("+96171123456");
  await page.getByRole("button", { name: "Book and pay" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: `Pay to secure your stay at ${place.name}` }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Whish's page (its simulator): the guest confirms with the code their app shows.
  await page.getByRole("button", { name: "Pay with Whish" }).click();
  await expect(page).toHaveURL(/\/whish-simulator\/pay\//);
  await page.getByLabel("Whish phone number").fill("96170123456");
  await page.getByLabel("Code sent to your Whish app").fill("111111");
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page).toHaveURL(/\/b\//, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: `You're going to ${place.name}` })).toBeVisible({
    timeout: 20_000,
  });
  const bookingUrl = page.url();

  await page.goto("/account");
  const trip = page.getByRole("link", {
    name: new RegExp(`^${place.name.replace(/[()]/g, "\\$&")}.*Confirmed`),
  });
  await expect(trip.first()).toBeVisible();

  await page.goto(bookingUrl);
  await page.getByRole("button", { name: "Cancel this booking" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Cancel/ })
    .last()
    .click();
  await expect(page.getByText(/refund/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /cancelled/i })).toBeVisible();

  expect(pageProblems).toEqual([]);
  await context.close();
});

test("writing to a host and to us", async ({ page }) => {
  await page.goto(`/p/${PLACES.automatic.slug}`);
  await page.getByRole("link", { name: "Contact host" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: `Contact ${PLACES.automatic.name}` }),
  ).toBeVisible();
  const host = page.getByRole("region", { name: "Still have questions? Message the host" });
  // Sent empty, the form says which fields to fill before anything goes out.
  await host.getByRole("button", { name: "Send message" }).click();
  await expect(host.getByRole("textbox", { name: "Your name" })).toHaveAttribute("aria-invalid", "true");
  await host.getByRole("textbox", { name: "Your name" }).fill("Joelle Karam");
  await host.getByRole("textbox", { name: "Your email" }).fill(newEmail("joelle"));
  await host
    .getByRole("textbox", { name: "Message" })
    .fill("Is the sea room quiet at night, and is there parking?");
  await host.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  await page.goto("/contact");
  await page.getByLabel("Your name").fill("Joelle Karam");
  await page.getByLabel("Your email").fill(newEmail("joelle"));
  await page.getByLabel("Message").fill("How do I list my guesthouse in Batroun?");
  await page.getByRole("button", { name: /Send/ }).click();
  await expect(page.getByRole("status")).toBeVisible();
});

test("the account pages: trips, notifications, downloading my data, and deleting the account", async ({
  page,
}) => {
  const email = await signUp(page, "Rami Fares");
  await page.goto("/account");
  const sections = page.getByRole("navigation", { name: "Account sections" });
  await sections.getByRole("link", { name: "Notifications" }).click();
  await expect(page.getByRole("heading", { name: "Notifications on this device" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn on notifications" })).toBeVisible();

  await sections.getByRole("link", { name: "Privacy" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download my data" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);

  await page.getByRole("button", { name: "Delete my account" }).click();
  const confirm = page.getByRole("dialog");
  await confirm.getByRole("textbox").fill(email);
  await confirm.getByRole("button", { name: "Delete for good" }).click();
  await expect(page).not.toHaveURL(/\/account/);

  // Gone for good: the account can no longer sign in.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});

test("becoming a host: a new account makes its own place and lands in its dashboard", async ({ page }) => {
  await newHost(page, "Nour Hayek");
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await expectNoSidewaysScroll(page);
});
