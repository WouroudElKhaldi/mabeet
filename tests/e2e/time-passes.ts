import type { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { e2eDatabaseUrl } from "./e2e-database";

// What clicking cannot do: let time go by. A request ends when its answer time runs out, a payout releases only
// money for stays that have started, and a refund is sent by hand only once the automatic one has not gone through
// for a day, so a test that shows those steps
// moves its own booking in time, the way the integration tests do. It only ever touches the browser tests' database,
// and only the booking the test itself just made in the browser.

const database = new PrismaClient({ datasourceUrl: e2eDatabaseUrl() });

/** The booking behind a guest's booking page (`/b/<token>`). */
async function bookingAt(bookingUrl: string) {
  const token = new URL(bookingUrl).pathname.split("/").pop() ?? "";
  return database.booking.findUniqueOrThrow({ where: { publicToken: token }, select: { id: true } });
}

/** The stay began two days ago: its money is now the host's to ask for. */
export async function stayHasStarted(bookingUrl: string) {
  const booking = await bookingAt(bookingUrl);
  const today = new Date();
  const checkIn = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 2));
  const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60_000);
  await database.booking.update({ where: { id: booking.id }, data: { checkIn, checkOut } });
}

/** The booking's refund did not go through a day ago, as when Whish refuses it: it waits to be sent by hand. */
export async function refundDidNotGoThrough(bookingUrl: string) {
  const booking = await bookingAt(bookingUrl);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000);
  const { count } = await database.refund.updateMany({
    where: { payment: { bookingId: booking.id }, isDeleted: false },
    data: { status: "PENDING", providerRef: null, doneAt: null, createdAt: twoDaysAgo },
  });
  if (count === 0) throw new Error("This booking has no refund to hold back");
}

/** The host's time to answer the request (or the guest's time to pay) ran out a minute ago. */
export async function answerTimeRanOut(bookingUrl: string) {
  const booking = await bookingAt(bookingUrl);
  await database.booking.update({
    where: { id: booking.id },
    data: { holdExpiresAt: new Date(Date.now() - 60_000) },
  });
}

/** Runs the scheduled housekeeping now, as the scheduler does, with the cron secret from `.env`. */
export async function runHousekeeping(page: Page) {
  const response = await page.request.post("/api/cron/expire-holds", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  if (!response.ok()) throw new Error(`Housekeeping answered ${response.status()}`);
}
