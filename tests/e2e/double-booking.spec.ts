import { expect, type Page } from "@playwright/test";
import { newContext, pickFreeStay, pickStay, PLACES, signedIn, test } from "./helpers";

// The "never double-booked" moment: two people, in two browsers, ask for the same nights at the same moment. One
// gets the booking; the other is told the dates were just taken, and nothing is booked twice.

const place = PLACES.offline;

/** Opens the booking form, filled in, without sending it: for free nights it finds, or for `stay` when given. */
async function readyToSend(page: Page, guestName: string, stay?: { checkIn: string; checkOut: string }) {
  await page.goto(`/p/${place.slug}`);
  await page
    .getByRole("button", { name: /Check-in/ })
    .first()
    .click();
  let picked = stay;
  if (picked) await pickStay(page, picked);
  else picked = await pickFreeStay(page, 3);
  await page.getByRole("link", { name: "Request to book" }).click();
  await page.getByLabel("Full name").fill(guestName);
  await page.getByLabel("Mobile number").fill("+96170123456");
  return picked;
}

test("two guests asking for the same nights at once: one booking, one calm refusal", async ({ browser }) => {
  // Any account can book; the front-desk account is a second person here, booking at a place they don't work in.
  const first = await newContext(browser, { storageState: signedIn("guest") });
  const second = await newContext(browser, { storageState: signedIn("staff") });
  const [one, two] = await Promise.all([first.newPage(), second.newPage()]);
  const stay = await readyToSend(one, "Maya Khoury");
  await readyToSend(two, "Nadim Aoun", stay);

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
