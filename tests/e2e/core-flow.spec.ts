import { expect, type Page, test } from "@playwright/test";
import {
  dayName,
  expectNoSidewaysScroll,
  freshStay,
  pickStay,
  placeDashboard,
  PLACES,
  signedIn,
  watchForErrors,
} from "./helpers";

// The flow shown on stage, on a 390px phone: a guest picks free dates at a place, asks for them and sees their
// booking page; the owner, in a second browser, finds the request and confirms it; the guest's page then says the
// stay is confirmed.

const place = PLACES.offline;

/** The guest asks for `stay` at the place, from its own page, and lands on the booking's page. */
async function requestStay(page: Page, stay: { checkIn: string; checkOut: string }, guestName: string) {
  await page.goto(`/p/${place.slug}`);
  await page
    .getByRole("button", { name: /Check-in/ })
    .first()
    .click();
  await pickStay(page, stay);
  await page.getByRole("link", { name: "Request to book" }).click();

  await expect(page.getByRole("heading", { name: "Book your stay" })).toBeVisible();
  await page.getByLabel("Full name").fill(guestName);
  await page.getByLabel("Mobile number").fill("+96171123456");
  await page.getByRole("button", { name: "Send request" }).click();
}

test("a guest requests a stay and the owner confirms it", async ({ browser }) => {
  const stay = freshStay();
  const guestName = `Rima Haddad ${Date.now() % 100_000}`;

  const guest = await browser.newContext({ storageState: signedIn("guest") });
  const guestPage = await guest.newPage();
  const guestProblems = watchForErrors(guestPage);
  await requestStay(guestPage, stay, guestName);
  await expect(guestPage).toHaveURL(/\/b\//);
  await expect(guestPage.getByRole("heading", { name: `Your room at ${place.name} is held` })).toBeVisible();
  await expectNoSidewaysScroll(guestPage);

  const owner = await browser.newContext({ storageState: signedIn("host") });
  const ownerPage = await owner.newPage();
  const ownerProblems = watchForErrors(ownerPage);
  await ownerPage.goto(await placeDashboard(ownerPage, place.name));
  await ownerPage.getByRole("link", { name: "Bookings", exact: true }).first().click();
  const row = ownerPage.getByRole("listitem").filter({ hasText: guestName });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Confirm" }).click();
  await ownerPage.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  // Answered, it leaves the requests and shows with the upcoming stays.
  await expect(row).toBeHidden();
  await ownerPage.getByRole("link", { name: "Upcoming" }).click();
  await expect(
    ownerPage.getByRole("listitem").filter({ hasText: guestName }).getByText("Confirmed"),
  ).toBeVisible();

  await guestPage.reload();
  await expect(guestPage.getByRole("heading", { name: `You're going to ${place.name}` })).toBeVisible();

  expect([...guestProblems, ...ownerProblems]).toEqual([]);
  await guest.close();
  await owner.close();
});

test("a night already taken cannot be picked", async ({ browser }) => {
  const stay = freshStay();
  const first = await browser.newContext({ storageState: signedIn("guest") });
  const page = await first.newPage();
  await requestStay(page, stay, "Karim Saad");
  await expect(page).toHaveURL(/\/b\//);

  // The same nights again, from the place's calendar: the first night now reads as not available.
  await page.goto(`/p/${place.slug}`);
  await page
    .getByRole("button", { name: /Check-in/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Choose your dates" });
  const night = dialog.getByRole("button", {
    name: new RegExp(`^${dayName(stay.checkIn)}.*Not available`),
  });
  for (let month = 0; month < 13 && !(await night.isVisible()); month += 1) {
    await dialog.getByRole("button", { name: "Next month" }).click();
  }
  await expect(night).toHaveAttribute("aria-disabled", "true");
  await first.close();
});
