import { expect, type Page, test } from "@playwright/test";
import { freshStay, pickStay, PLACES, signedIn } from "./helpers";

// The "never double-booked" moment: two people, in two browsers, ask for the same nights at the same moment. One
// gets the booking; the other is told the dates were just taken, and nothing is booked twice.

const place = PLACES.offline;

/** Opens the booking form for `stay`, filled in, without sending it. */
async function readyToSend(page: Page, stay: { checkIn: string; checkOut: string }, guestName: string) {
  await page.goto(`/p/${place.slug}`);
  await page
    .getByRole("button", { name: /Check-in/ })
    .first()
    .click();
  await pickStay(page, stay);
  await page.getByRole("link", { name: "Request to book" }).click();
  await page.getByLabel("Full name").fill(guestName);
  await page.getByLabel("Mobile number").fill("+96170123456");
}

test("two guests asking for the same nights at once: one booking, one calm refusal", async ({ browser }) => {
  const stay = freshStay(3);
  // Any account can book; the front-desk account is a second person here, booking at a place they don't work in.
  const first = await browser.newContext({ storageState: signedIn("guest") });
  const second = await browser.newContext({ storageState: signedIn("staff") });
  const [one, two] = await Promise.all([first.newPage(), second.newPage()]);
  await readyToSend(one, stay, "Maya Khoury");
  await readyToSend(two, stay, "Nadim Aoun");

  await Promise.all([
    one.getByRole("button", { name: "Send request" }).click(),
    two.getByRole("button", { name: "Send request" }).click(),
  ]);

  const booked = (page: Page) => page.waitForURL(/\/b\//, { timeout: 15_000 }).then(() => page);
  const winner = await Promise.any([booked(one), booked(two)]);
  const loser = winner === one ? two : one;
  await expect(loser.getByRole("alert").filter({ hasText: "Those dates were just taken" })).toBeVisible();
  await expect(loser).not.toHaveURL(/\/b\//);

  await first.close();
  await second.close();
});
