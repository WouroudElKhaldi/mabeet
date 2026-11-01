import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as checkoutRoute from "@/app/api/public/bookings/[token]/checkout/route";
import * as callback from "@/app/api/payments/whish/callback/route";
import * as simulatorPay from "@/app/api/whish-simulator/pay/[code]/route";
import { handleStripeWebhook } from "@/modules/billing/server";
import { runHousekeeping } from "@/modules/housekeeping/server";
import { env } from "@/server/env";
import { prisma, stay } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { sendPaymentsToTheApp } from "@tests/integration/payments-in-process";
import {
  cancelBooking,
  cancelStayAsGuest,
  confirmBooking,
  declineBooking,
  onlinePaymentMethods,
  refreshGuestPayments,
  requestBooking,
  retryPendingRefunds,
  startBookingCheckout,
} from "../server";
import { placeWithRoom, requestFor } from "./fixtures";

// Guests paying online for the full total, end to end: Whish through its simulator, cards through a stand-in Stripe.
// The provider's answer decides; the booking then moves on by its mode; and every paid booking that ends is
// refunded in full.

const WEBHOOK_SECRET = "whsec_bookings_test";
const HOUR_MS = 3_600_000;

const saved = {
  STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
  WHISH_MODE: env.WHISH_MODE,
};
beforeAll(() => {
  Object.assign(env, {
    STRIPE_SECRET_KEY: "sk_test_bookings",
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    WHISH_MODE: "simulator",
  });
});
afterAll(() => {
  Object.assign(env, saved);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const codeOf = (url: string) => new URL(url).pathname.split("/").pop()!;
const payOnWhish = (url: string, otp = "111111") =>
  call(simulatorPay.POST, { params: { code: codeOf(url) }, body: { phone: "96170123456", otp } });

/** Stripe telling us a card checkout finished, signed with the webhook secret. */
function stripeCheckoutCompleted(sessionId: string, paymentId: string) {
  const body = JSON.stringify({
    id: `evt_${sessionId}`,
    type: "checkout.session.completed",
    data: { object: { id: sessionId, mode: "payment", metadata: { paymentId } } },
  });
  const at = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(`${at}.${body}`).digest("hex");
  return handleStripeWebhook(body, `t=${at},v1=${signature}`);
}

const bookingOf = (id: string) => prisma.booking.findUniqueOrThrow({ where: { id } });
const paymentsOf = (bookingId: string) =>
  prisma.payment.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    include: { refunds: true },
  });

describe("paying online", () => {
  it("mode 1 with Whish: a wrong code changes nothing, the right one confirms it, a repeated callback adds nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendPaymentsToTheApp();
    const place = await placeWithRoom("AUTOMATIC", { baseRateCents: 9_000 });
    const booking = await requestBooking(requestFor(place, stay(10, 2)));

    const url = await startBookingCheckout(booking.publicToken, place.guest.id, "WHISH");
    expect(url).toMatch(/\/whish-simulator\/pay\/[\w-]+$/);
    const [pending] = await paymentsOf(booking.id);
    expect(pending).toMatchObject({
      amountCents: 18_000,
      currency: "USD",
      method: "WHISH",
      status: "PENDING",
    });
    expect(pending?.providerRef).toBe(`whish:${pending?.id}`);

    expect((await payOnWhish(url, "000000")).body).toEqual({ ok: false, redirect: null });
    expect((await bookingOf(booking.id)).status).toBe("AWAITING_PAYMENT");

    await payOnWhish(url);
    expect(await bookingOf(booking.id)).toMatchObject({ status: "CONFIRMED", holdExpiresAt: null });
    const [paid] = await paymentsOf(booking.id);
    expect(paid).toMatchObject({ status: "PAID", note: "Whish 96170123456", paidAt: expect.any(Date) });
    expect(
      await prisma.auditLog.count({ where: { entityId: booking.id, action: "payment.online_confirmed" } }),
    ).toBe(1);

    const replay = await call(callback.GET, { query: { payment: paid!.id } });
    expect(replay).toEqual({ status: 200, body: { ok: true, result: "paid" } });
    expect(await prisma.payment.count({ where: { bookingId: booking.id, status: "PAID" } })).toBe(1);
  });

  it("mode 2 by card: the signed webhook sends it to the owner with their answer time, and a decline refunds it all", async () => {
    const { stripe } = sendPaymentsToTheApp();
    const place = await placeWithRoom("ONLINE_APPROVAL", { baseRateCents: 12_500 });
    const booking = await requestBooking(requestFor(place, stay(10, 2)));

    const url = await startBookingCheckout(booking.publicToken, place.guest.id, "CARD");
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const [payment] = await paymentsOf(booking.id);
    const created = stripe.calls.find((entry) => entry.path === "/checkout/sessions");
    expect(created?.form.get("mode")).toBe("payment");
    expect(created?.form.get("line_items[0][price_data][unit_amount]")).toBe("25000");
    expect(created?.form.get("metadata[paymentId]")).toBe(payment!.id);

    stripe.paid.set(payment!.providerRef!, true);
    const now = Date.now();
    expect(await stripeCheckoutCompleted(payment!.providerRef!, payment!.id)).toBe("applied");
    const held = await bookingOf(booking.id);
    expect(held.status).toBe("HELD");
    expect(held.holdExpiresAt!.getTime()).toBeGreaterThanOrEqual(now + 24 * HOUR_MS - 5_000);
    expect((await paymentsOf(booking.id))[0]).toMatchObject({
      status: "PAID",
      providerPaymentId: `pi_${payment!.providerRef}`,
    });

    await declineBooking(place.ctx, { bookingId: booking.id });
    const [refunded] = await paymentsOf(booking.id);
    expect(refunded).toMatchObject({ status: "REFUNDED", refundedCents: 25_000 });
    expect(refunded?.refunds).toEqual([
      expect.objectContaining({ amountCents: 25_000, status: "DONE", reason: "Declined by the host" }),
    ]);
    const refundCall = stripe.calls.find((entry) => entry.path === "/refunds");
    expect(refundCall?.form.get("amount")).toBe("25000");
    expect(refundCall?.idempotencyKey).toBe(`refund-${refunded!.refunds[0]!.id}`);
  });

  it("mode 2 with Whish: paid, then the owner never answers, so it expires and is refunded through Whish", async () => {
    sendPaymentsToTheApp();
    const place = await placeWithRoom("ONLINE_APPROVAL");
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    await payOnWhish(await startBookingCheckout(booking.publicToken, place.guest.id, "WHISH"));
    expect((await bookingOf(booking.id)).status).toBe("HELD");

    await runHousekeeping(new Date(Date.now() + 25 * HOUR_MS));
    expect((await bookingOf(booking.id)).status).toBe("EXPIRED");
    const [payment] = await paymentsOf(booking.id);
    expect(payment?.refunds).toEqual([
      expect.objectContaining({ status: "DONE", providerRef: `whish:${payment!.id}` }),
    ]);
    expect(
      (await prisma.whishSandboxPayment.findUniqueOrThrow({ where: { externalId: payment!.id } })).status,
    ).toBe("refunded");
  });

  it("refunds in full when the guest cancels, or the owner cancels a confirmed booking", async () => {
    sendPaymentsToTheApp();
    const place = await placeWithRoom("ONLINE_APPROVAL");
    const byGuest = await requestBooking(requestFor(place, stay(10, 2)));
    await payOnWhish(await startBookingCheckout(byGuest.publicToken, place.guest.id, "WHISH"));
    await cancelStayAsGuest(byGuest.publicToken, place.guest.id, "Plans changed");
    expect((await paymentsOf(byGuest.id))[0]?.refunds).toEqual([
      expect.objectContaining({ status: "DONE", reason: "Cancelled by the guest" }),
    ]);

    const byOwner = await requestBooking(requestFor(place, stay(20, 2)));
    await payOnWhish(await startBookingCheckout(byOwner.publicToken, place.guest.id, "WHISH"));
    await confirmBooking(place.ctx, { bookingId: byOwner.id });
    await cancelBooking(place.ctx, { bookingId: byOwner.id });
    // Cancelling again is refused, so nothing is ever given back twice.
    await expect(cancelBooking(place.ctx, { bookingId: byOwner.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const [payment] = await paymentsOf(byOwner.id);
    expect(payment?.refunds).toHaveLength(1);
    expect(payment?.refunds[0]).toMatchObject({ status: "DONE", reason: "Cancelled by the host" });
  });

  it("never refunds a stay that has started: its money may already be paid out to the owner", async () => {
    sendPaymentsToTheApp();
    const place = await placeWithRoom("ONLINE_APPROVAL");
    const range = stay(10, 3);
    const booking = await requestBooking(requestFor(place, range));
    await payOnWhish(await startBookingCheckout(booking.publicToken, place.guest.id, "WHISH"));
    await confirmBooking(place.ctx, { bookingId: booking.id });

    const checkInDay = new Date(range.checkIn.getTime() + 12 * HOUR_MS);
    await expect(cancelBooking(place.ctx, { bookingId: booking.id }, checkInDay)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This stay has already started, so it can no longer be cancelled.",
    });
    await expect(
      cancelStayAsGuest(booking.publicToken, place.guest.id, null, checkInDay),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await bookingOf(booking.id)).status).toBe("CONFIRMED");
    const [payment] = await paymentsOf(booking.id);
    expect(payment).toMatchObject({ status: "PAID", refundedCents: 0 });
    expect(payment?.refunds).toEqual([]);
  });

  it("refunds a payment that lands after the booking ran out, and leaves the booking ended", async () => {
    sendPaymentsToTheApp();
    const place = await placeWithRoom("AUTOMATIC");
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    const url = await startBookingCheckout(booking.publicToken, place.guest.id, "WHISH");
    // Nobody paid within the 10 minutes.
    await runHousekeeping(new Date(Date.now() + 11 * 60_000));
    expect((await bookingOf(booking.id)).status).toBe("EXPIRED");

    await payOnWhish(url);
    expect((await bookingOf(booking.id)).status).toBe("EXPIRED");
    const [payment] = await paymentsOf(booking.id);
    expect(payment).toMatchObject({ status: "REFUNDED" });
    expect(payment?.refunds).toEqual([expect.objectContaining({ status: "DONE" })]);
    expect(
      await prisma.auditLog.count({ where: { entityId: booking.id, action: "payment.online_late" } }),
    ).toBe(1);
  });

  it("checks a payment at once when the guest comes back, even if the callback never came", async () => {
    const { stripe } = sendPaymentsToTheApp();
    const place = await placeWithRoom("AUTOMATIC");
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    await startBookingCheckout(booking.publicToken, place.guest.id, "CARD");
    const [payment] = await paymentsOf(booking.id);
    stripe.paid.set(payment!.providerRef!, true);
    await refreshGuestPayments(booking.publicToken, place.guest.id);
    expect((await bookingOf(booking.id)).status).toBe("CONFIRMED");
  });
});

describe("what cannot be paid", () => {
  it("refuses an offline booking, one already paid, one whose time ran out, and someone else's", async () => {
    sendPaymentsToTheApp();
    const offline = await placeWithRoom("OFFLINE");
    const request = await requestBooking(requestFor(offline, stay(10, 2)));
    await expect(startBookingCheckout(request.publicToken, offline.guest.id, "WHISH")).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const online = await placeWithRoom("AUTOMATIC");
    const now = new Date();
    const late = await requestBooking(requestFor(online, stay(10, 2)), now);
    await expect(
      startBookingCheckout(late.publicToken, online.guest.id, "WHISH", new Date(now.getTime() + 11 * 60_000)),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "The time to pay has run out. Please book again." });
    await expect(startBookingCheckout(late.publicToken, offline.guest.id, "WHISH")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await payOnWhish(await startBookingCheckout(late.publicToken, online.guest.id, "WHISH"));
    await expect(startBookingCheckout(late.publicToken, online.guest.id, "WHISH")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("offers Whish for dollars and pounds, cards for dollars and euros, and no card without Stripe keys", () => {
    expect(onlinePaymentMethods("USD")).toEqual(["WHISH", "CARD"]);
    expect(onlinePaymentMethods("LBP")).toEqual(["WHISH"]);
    expect(onlinePaymentMethods("EUR")).toEqual(["CARD"]);
    env.STRIPE_SECRET_KEY = undefined;
    try {
      expect(onlinePaymentMethods("USD")).toEqual(["WHISH"]);
    } finally {
      env.STRIPE_SECRET_KEY = "sk_test_bookings";
    }
  });

  it("says card payments are not set up when Stripe has no keys, rather than blaming the currency", async () => {
    sendPaymentsToTheApp();
    const place = await placeWithRoom("AUTOMATIC");
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    env.STRIPE_SECRET_KEY = undefined;
    try {
      await expect(startBookingCheckout(booking.publicToken, place.guest.id, "CARD")).rejects.toMatchObject({
        code: "UNAVAILABLE",
        message: "Card payments are not set up yet.",
      });
    } finally {
      env.STRIPE_SECRET_KEY = "sk_test_bookings";
    }
    expect(await paymentsOf(booking.id)).toEqual([]);
  });

  it("refuses a card for pounds", async () => {
    sendPaymentsToTheApp();
    const place = await placeWithRoom("AUTOMATIC");
    await prisma.business.update({ where: { id: place.business.id }, data: { currency: "LBP" } });
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    await expect(startBookingCheckout(booking.publicToken, place.guest.id, "CARD")).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("leaves nothing waiting, and the booking as it was, when Whish is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ status: false, code: "500", dialog: null, actions: null, extra: null, data: null }),
      ),
    );
    const place = await placeWithRoom("AUTOMATIC");
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    await expect(startBookingCheckout(booking.publicToken, place.guest.id, "WHISH")).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    expect((await paymentsOf(booking.id)).map((payment) => payment.status)).toEqual(["FAILED"]);
    expect((await bookingOf(booking.id)).status).toBe("AWAITING_PAYMENT");
  });
});

describe("refunds a provider refuses", () => {
  it("stay owed, and are sent again later with the same key, so the guest is never paid twice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { stripe } = sendPaymentsToTheApp();
    const place = await placeWithRoom("ONLINE_APPROVAL");
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    await startBookingCheckout(booking.publicToken, place.guest.id, "CARD");
    const [payment] = await paymentsOf(booking.id);
    stripe.paid.set(payment!.providerRef!, true);
    await refreshGuestPayments(booking.publicToken, place.guest.id);

    stripe.refundsDown = true;
    await declineBooking(place.ctx, { bookingId: booking.id });
    const [owed] = (await paymentsOf(booking.id))[0]!.refunds;
    expect(owed).toMatchObject({ status: "PENDING", providerRef: null });

    stripe.refundsDown = false;
    expect(await retryPendingRefunds()).toMatchObject({ sent: expect.any(Number) });
    expect(await prisma.refund.findUniqueOrThrow({ where: { id: owed!.id } })).toMatchObject({
      status: "DONE",
    });
    const attempts = stripe.calls.filter((entry) => entry.path === "/refunds");
    expect(attempts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(attempts.map((entry) => entry.idempotencyKey))).toEqual(new Set([`refund-${owed!.id}`]));
  });
});

describe("the checkout route", () => {
  it("needs the guest signed in, and answers with the payment page", async () => {
    sendPaymentsToTheApp();
    const guest = await signUp("Maya Haddad");
    const place = await placeWithRoom("AUTOMATIC");
    const booking = await requestBooking(requestFor(place, stay(10, 2), { guestUserId: guest.userId }));
    const params = { token: booking.publicToken };

    expect((await call(checkoutRoute.POST, { params, body: { method: "WHISH" } })).status).toBe(401);
    expect((await call(checkoutRoute.POST, { as: guest, params, body: { method: "OMT" } })).status).toBe(400);
    const paid = await call(checkoutRoute.POST, { as: guest, params, body: { method: "WHISH" } });
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({ url: expect.stringContaining("/whish-simulator/pay/") });
  });
});
