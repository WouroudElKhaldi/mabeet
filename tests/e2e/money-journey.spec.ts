import { expect } from "@playwright/test";
import {
  bookAndPayWithWhish,
  newContext,
  placeDashboard,
  PLACES,
  signedIn,
  signUp,
  test,
  watchForErrors,
} from "./helpers";
import { answerTimeRanOut, refundDidNotGoThrough, runHousekeeping, stayHasStarted } from "./time-passes";

// The money a guest pays online, to the end: at a place that asks the host first, the guest pays and the host
// confirms (or declines, or never answers, and the guest is refunded in full); once a paid stay has started, its host asks for the
// money and an admin sends it; and a refund the automatic one could not send is sent by hand by an admin. Each test
// books as a new guest of its own: one account may only book so often, and the other files book as the demo guest.

const approval = PLACES.approval;
const automatic = PLACES.automatic;

test("asking the host first: the guest pays, then the host confirms", async ({ browser }) => {
  const guest = await newContext(browser);
  const guestPage = await guest.newPage();
  await signUp(guestPage, "Paying Guest");
  const host = await newContext(browser, { storageState: signedIn("host") });
  const hostPage = await host.newPage();
  const problems = [watchForErrors(guestPage), watchForErrors(hostPage)];
  const guestName = `Ziad Moussa ${Date.now() % 100_000}`;

  const booking = await bookAndPayWithWhish(guestPage, approval.slug, guestName, "Request to book");
  await expect(guestPage.getByRole("heading", { level: 1 })).toContainText(approval.name);

  await hostPage.goto(`${await placeDashboard(hostPage, approval.name)}/bookings`);
  const request = hostPage.getByRole("listitem").filter({ hasText: guestName });
  await request.getByRole("button", { name: "Confirm" }).click();
  await hostPage.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(request).toBeHidden();

  await guestPage.goto(booking);
  await expect(guestPage.getByRole("heading", { name: `You're going to ${approval.name}` })).toBeVisible();
  expect(problems.flat()).toEqual([]);
  await guest.close();
  await host.close();
});

test("asking the host first: the host declines a paid request, and the guest is refunded in full", async ({
  browser,
}) => {
  const guest = await newContext(browser);
  const guestPage = await guest.newPage();
  await signUp(guestPage, "Paying Guest");
  const host = await newContext(browser, { storageState: signedIn("host") });
  const hostPage = await host.newPage();
  const problems = [watchForErrors(guestPage), watchForErrors(hostPage)];
  const guestName = `Rita Gemayel ${Date.now() % 100_000}`;

  const booking = await bookAndPayWithWhish(guestPage, approval.slug, guestName, "Request to book");
  const dashboard = await placeDashboard(hostPage, approval.name);
  await hostPage.goto(`${dashboard}/bookings`);
  const request = hostPage.getByRole("listitem").filter({ hasText: guestName });
  await request.getByRole("button", { name: "Decline" }).click();
  await hostPage.getByRole("dialog").getByRole("button", { name: "Decline" }).click();
  await expect(request).toBeHidden();

  await guestPage.goto(booking);
  await expect(guestPage.getByRole("heading", { level: 1 })).toContainText("couldn't take this booking");
  await expect(guestPage.getByText(/refund/i).first()).toBeVisible();
  await hostPage.goto(`${dashboard}/payouts`);
  await expect(
    hostPage
      .getByRole("region", { name: "Online payments" })
      .getByRole("listitem")
      .filter({ hasText: guestName }),
  ).toContainText("refunded");
  expect(problems.flat()).toEqual([]);
  await guest.close();
  await host.close();
});

test("asking the host first: the host never answers, the request ends, and the guest is refunded in full", async ({
  browser,
}) => {
  const guest = await newContext(browser);
  const guestPage = await guest.newPage();
  await signUp(guestPage, "Paying Guest");
  const host = await newContext(browser, { storageState: signedIn("host") });
  const hostPage = await host.newPage();
  const problems = [watchForErrors(guestPage), watchForErrors(hostPage)];
  const guestName = `Nayla Rizk ${Date.now() % 100_000}`;

  const booking = await bookAndPayWithWhish(guestPage, approval.slug, guestName, "Request to book");
  await answerTimeRanOut(booking);
  await runHousekeeping(guestPage);

  await guestPage.goto(booking);
  await expect(guestPage.getByText(/refund/i).first()).toBeVisible();
  await hostPage.goto(`${await placeDashboard(hostPage, approval.name)}/bookings`);
  await expect(hostPage.getByRole("listitem").filter({ hasText: guestName })).toBeHidden();
  expect(problems.flat()).toEqual([]);
  await guest.close();
  await host.close();
});

test("a paid stay that has started: the host asks for the money, and an admin sends it", async ({
  browser,
}) => {
  const guest = await newContext(browser);
  const guestPage = await guest.newPage();
  await signUp(guestPage, "Paying Guest");
  const booking = await bookAndPayWithWhish(
    guestPage,
    automatic.slug,
    `Omar Tannous ${Date.now() % 100_000}`,
  );
  await stayHasStarted(booking);
  await guest.close();

  const host = await newContext(browser, { storageState: signedIn("host") });
  const hostPage = await host.newPage();
  const admin = await newContext(browser, { storageState: signedIn("admin") });
  const adminPage = await admin.newPage();
  const problems = [watchForErrors(hostPage), watchForErrors(adminPage)];

  await hostPage.goto(`${await placeDashboard(hostPage, automatic.name)}/payouts`);
  const ask = hostPage.getByRole("region", { name: "Ask for a payout" });
  const holder = `Demo Host ${Date.now() % 100_000}`;
  await ask.getByLabel("Amount").fill("10");
  await ask.getByLabel("Account holder's name").fill(holder);
  await ask.getByLabel("Whish phone number").fill("+96170123456");
  await ask.getByRole("button", { name: "Ask for it" }).click();
  await expect(hostPage.getByText("Requested. You'll be told when it's sent.")).toBeVisible();

  await adminPage.goto("/admin/money");
  const payout = adminPage
    .getByRole("region", { name: "Payouts to send" })
    .getByRole("listitem")
    .filter({ hasText: holder });
  const transfer = `WH-${Date.now() % 1_000_000}`;
  await payout.getByPlaceholder("Transfer reference").fill(transfer);
  await payout.getByRole("button", { name: "Mark as sent" }).click();
  await expect(payout).toBeHidden();
  await expect(adminPage.getByRole("region", { name: "Recent payouts" })).toContainText(transfer);

  expect(problems.flat()).toEqual([]);
  await host.close();
  await admin.close();
});

test("a refund that did not go through: an admin sends it by hand", async ({ browser }) => {
  const guest = await newContext(browser);
  const guestPage = await guest.newPage();
  await signUp(guestPage, "Paying Guest");
  const booking = await bookAndPayWithWhish(guestPage, automatic.slug, `Lara Chami ${Date.now() % 100_000}`);
  const reference = (
    (await guestPage
      .getByText(/^Booking MB-/)
      .first()
      .textContent()) ?? ""
  ).replace("Booking ", "");
  await guestPage.getByRole("button", { name: "Cancel this booking" }).click();
  await guestPage
    .getByRole("dialog")
    .getByRole("button", { name: /Cancel/ })
    .last()
    .click();
  await expect(guestPage.getByRole("heading", { name: /cancelled/i })).toBeVisible();
  await refundDidNotGoThrough(booking);
  await guest.close();

  const admin = await newContext(browser, { storageState: signedIn("admin") });
  const adminPage = await admin.newPage();
  const problems = watchForErrors(adminPage);
  await adminPage.goto("/admin/money");
  const refund = adminPage
    .getByRole("region", { name: "Refunds to send by hand" })
    .getByRole("listitem")
    .filter({ hasText: reference });
  await refund.getByPlaceholder("Transfer reference").fill(`WR-${Date.now() % 1_000_000}`);
  await refund.getByRole("button", { name: "Mark as sent" }).click();
  await expect(refund).toBeHidden();
  expect(problems).toEqual([]);
  await admin.close();
});
