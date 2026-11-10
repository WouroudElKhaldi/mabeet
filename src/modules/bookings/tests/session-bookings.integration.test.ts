import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as cancelRoute from "@/app/api/public/bookings/[token]/cancel/route";
import * as requestRoute from "@/app/api/public/experiences/[slug]/bookings/route";
import * as decisionRoute from "@/app/api/workspaces/[businessId]/session-bookings/[bookingId]/[action]/route";
import * as sessionRoute from "@/app/api/workspaces/[businessId]/sessions/[sessionId]/route";
import * as simulatorPay from "@/app/api/whish-simulator/pay/[code]/route";
import { runHousekeeping } from "@/modules/housekeeping/server";
import { env } from "@/server/env";
import { addDays, todayUtc } from "@/utils/dates";
import { memberWith, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { sendPaymentsToTheApp } from "@tests/integration/payments-in-process";
import {
  cancelBookingAsGuest,
  cancelSession,
  cancelSessionBooking,
  confirmSessionBooking,
  declineSessionBooking,
  getPayouts,
  listSessionBookings,
  requestSessionBooking,
  startBookingCheckout,
} from "../server";
import { placeWithSession, seatsFor } from "./fixtures";

// Seats in a session of an experience or service: the same engine as a stay. They are taken at once, the business's
// mode decides what happens next, the database never seats more guests than the session has, and paid seats that
// end are refunded in full.

const HOUR_MS = 3_600_000;
const seatsOf = (id: string) => prisma.sessionBooking.findUniqueOrThrow({ where: { id } });
const paymentsOf = (sessionBookingId: string) =>
  prisma.payment.findMany({ where: { sessionBookingId }, include: { refunds: true } });

const saved = { WHISH_MODE: env.WHISH_MODE };
beforeAll(() => {
  Object.assign(env, { WHISH_MODE: "simulator" });
});
afterAll(() => {
  Object.assign(env, saved);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const codeOf = (url: string) => new URL(url).pathname.split("/").pop()!;
const payOnWhish = (url: string) =>
  call(simulatorPay.POST, { params: { code: codeOf(url) }, body: { phone: "96170123456", otp: "111111" } });

describe("asking for seats", () => {
  it("offline: holds the seats for the owner, never past the session's start, and prices them per person", async () => {
    const startsAt = new Date(Date.now() + 5 * HOUR_MS);
    const place = await placeWithSession("OFFLINE", { startsAt });
    await prisma.business.update({ where: { id: place.business.id }, data: { holdHours: 24 } });
    const booking = await requestSessionBooking(seatsFor(place, 3));
    expect(booking).toMatchObject({ status: "HELD", seats: 3, totalCents: 7_500, bookingMode: "OFFLINE" });
    expect(booking.holdExpiresAt).toEqual(startsAt);
    const log = await prisma.auditLog.findFirst({
      where: { entityId: booking.id, action: "booking.requested" },
    });
    expect(log).toMatchObject({ entity: "session_booking", businessId: place.business.id });
  });

  it("prices a group once, refuses more guests than book together, and a session that has started", async () => {
    const place = await placeWithSession("OFFLINE", {
      priceCents: 12_000,
      priceUnit: "PER_GROUP",
      maxGuests: 4,
    });
    expect((await requestSessionBooking(seatsFor(place, 4))).totalCents).toBe(12_000);
    await expect(requestSessionBooking(seatsFor(place, 5))).rejects.toMatchObject({
      code: "VALIDATION",
      message: "Up to 4 guests can book together",
    });
    await prisma.offeringSession.update({
      where: { id: place.session.id },
      data: { startsAt: new Date(Date.now() - 60_000) },
    });
    await expect(requestSessionBooking(seatsFor(place, 1))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("over HTTP needs an account, and answers with the booking's link", async () => {
    const place = await placeWithSession("OFFLINE");
    const body = {
      sessionId: place.session.id,
      seats: 2,
      guestName: "Rami Saad",
      guestPhone: "+96171222333",
    };
    const signedOut = await call(requestRoute.POST, { params: { slug: place.offering.slug }, body });
    expect(signedOut.status).toBe(401);
    const guest = await signUp("Rami Saad");
    const made = await call(requestRoute.POST, { as: guest, params: { slug: place.offering.slug }, body });
    expect(made).toMatchObject({ status: 201, body: { status: "HELD", publicToken: expect.any(String) } });
    expect(await prisma.sessionBooking.count({ where: { guestUserId: guest.userId } })).toBe(1);
  });
});

describe("the owner's answers", () => {
  it("confirms or declines, gives declined seats back, and logs who decided", async () => {
    const place = await placeWithSession("OFFLINE", { capacity: 4 });
    const first = await requestSessionBooking(seatsFor(place, 2));
    const second = await requestSessionBooking(seatsFor(place, 2));
    await expect(requestSessionBooking(seatsFor(place, 1))).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await confirmSessionBooking(place.ctx, { bookingId: first.id })).toMatchObject({
      status: "CONFIRMED",
    });
    await declineSessionBooking(place.ctx, { bookingId: second.id, reason: "Private group that day" });
    expect(await seatsOf(second.id)).toMatchObject({ status: "DECLINED", decidedById: place.owner.id });
    // The declined seats are free again.
    await expect(requestSessionBooking(seatsFor(place, 2))).resolves.toMatchObject({ status: "HELD" });
    await expect(confirmSessionBooking(place.ctx, { bookingId: second.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("can't answer seats waiting for the online payment, or seats of another business", async () => {
    const place = await placeWithSession("AUTOMATIC");
    const booking = await requestSessionBooking(seatsFor(place, 1));
    expect(booking.status).toBe("AWAITING_PAYMENT");
    await expect(confirmSessionBooking(place.ctx, { bookingId: booking.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const other = await placeWithSession("OFFLINE");
    await expect(declineSessionBooking(other.ctx, { bookingId: booking.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    await expect(cancelSessionBooking(staff, { bookingId: booking.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lists the seats for the team, hiding the guest's phone from staff without guests.contact", async () => {
    const place = await placeWithSession("OFFLINE");
    const booking = await requestSessionBooking(seatsFor(place, 2));
    const [listed] = await listSessionBookings(place.ctx, { take: 10, skip: 0 });
    expect(listed).toMatchObject({
      id: booking.id,
      guestPhone: "+96171123456",
      offering: { title: "Wine tasting in the Bekaa" },
      session: { startsAt: place.session.startsAt },
    });
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    const [masked] = await listSessionBookings(staff, { status: "HELD", take: 10, skip: 0 });
    expect(masked?.guestPhone).not.toBe("+96171123456");
    expect(await listSessionBookings(place.ctx, { status: "CONFIRMED", take: 10, skip: 0 })).toEqual([]);
  });

  it("over HTTP, answers only inside the business", async () => {
    const place = await placeWithSession("OFFLINE");
    const booking = await requestSessionBooking(seatsFor(place, 1));
    const stranger = await signUp("Stranger");
    const refused = await call(decisionRoute.POST, {
      as: stranger,
      params: { businessId: place.business.id, bookingId: booking.id, action: "confirm" },
      body: {},
    });
    expect(refused.status).toBe(404);
    expect((await seatsOf(booking.id)).status).toBe("HELD");
  });
});

describe("paying for seats online", () => {
  it("mode 1: paying with Whish confirms them; the host's cancel refunds it all, and the money shows on payouts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendPaymentsToTheApp();
    const place = await placeWithSession("AUTOMATIC", { priceCents: 3_000 });
    const booking = await requestSessionBooking(seatsFor(place, 2));
    expect(booking.holdExpiresAt!.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60_000);

    const url = await startBookingCheckout(booking.publicToken, place.guest.id, "WHISH");
    await payOnWhish(url);
    expect(await seatsOf(booking.id)).toMatchObject({ status: "CONFIRMED", holdExpiresAt: null });
    const [paid] = await paymentsOf(booking.id);
    expect(paid).toMatchObject({ status: "PAID", amountCents: 6_000, bookingId: null });
    const payouts = await getPayouts(place.ctx);
    expect(payouts.balances).toEqual([expect.objectContaining({ currency: "USD", upcomingCents: 6_000 })]);
    expect(payouts.payments[0]?.booking).toMatchObject({ reference: booking.reference });

    await cancelSessionBooking(place.ctx, { bookingId: booking.id, reason: "Storm warning" });
    const [refunded] = await paymentsOf(booking.id);
    expect(refunded).toMatchObject({ status: "REFUNDED", refundedCents: 6_000 });
    expect(refunded?.refunds).toEqual([expect.objectContaining({ amountCents: 6_000, status: "DONE" })]);
  });

  it("mode 2: once paid the seats wait for the owner, never past the start, and a decline refunds them", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendPaymentsToTheApp();
    const startsAt = new Date(Date.now() + 6 * HOUR_MS);
    const place = await placeWithSession("ONLINE_APPROVAL", { startsAt });
    await prisma.business.update({ where: { id: place.business.id }, data: { holdHours: 48 } });
    const booking = await requestSessionBooking(seatsFor(place, 1));
    await payOnWhish(await startBookingCheckout(booking.publicToken, place.guest.id, "WHISH"));
    expect(await seatsOf(booking.id)).toMatchObject({ status: "HELD", holdExpiresAt: startsAt });

    await declineSessionBooking(place.ctx, { bookingId: booking.id });
    const [refunded] = await paymentsOf(booking.id);
    expect(refunded).toMatchObject({ status: "REFUNDED", refundedCents: 2_500 });
  });

  it("an unpaid booking expires with housekeeping and gives its seats back", async () => {
    const place = await placeWithSession("AUTOMATIC", { capacity: 2 });
    const booking = await requestSessionBooking(seatsFor(place, 2));
    const later = new Date(Date.now() + 11 * 60_000);
    const result = await runHousekeeping(later);
    expect(result.expiredSeats).toBeGreaterThanOrEqual(1);
    expect((await seatsOf(booking.id)).status).toBe("EXPIRED");
    await expect(requestSessionBooking(seatsFor(place, 2), later)).resolves.toMatchObject({
      status: "AWAITING_PAYMENT",
    });
  });
});

describe("the guest cancels", () => {
  it("their own seats before the session's day, over the same route as a stay", async () => {
    const place = await placeWithSession("OFFLINE");
    const guest = await signUp("Lina Khoury");
    const booking = await requestSessionBooking(seatsFor(place, 2, { guestUserId: guest.userId }));
    const stranger = await signUp("Someone else");
    const notTheirs = await call(cancelRoute.POST, {
      as: stranger,
      params: { token: booking.publicToken },
      body: {},
    });
    expect(notTheirs.status).toBe(404);
    const cancelled = await call(cancelRoute.POST, {
      as: guest,
      params: { token: booking.publicToken },
      body: { reason: "Flight moved" },
    });
    expect(cancelled).toEqual({ status: 200, body: { status: "CANCELLED" } });
    expect(await seatsOf(booking.id)).toMatchObject({ cancelReason: "Flight moved" });
  });

  it("not on the session's day", async () => {
    const startsAt = new Date(addDays(todayUtc(), 10).getTime() + 12 * HOUR_MS);
    const place = await placeWithSession("OFFLINE", { startsAt });
    const booking = await requestSessionBooking(seatsFor(place, 1));
    const sessionDay = new Date(startsAt.getTime() - 2 * HOUR_MS);
    await expect(
      cancelBookingAsGuest(booking.publicToken, place.guest.id, null, sessionDay),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("cancelling a session", () => {
  it("is refused while guests hold seats in it, and allowed once their bookings end", async () => {
    const place = await placeWithSession("OFFLINE");
    const booking = await requestSessionBooking(seatsFor(place, 1));
    await expect(cancelSession(place.ctx, place.session.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await declineSessionBooking(place.ctx, { bookingId: booking.id });

    await cancelSession(place.ctx, place.session.id);
    expect(await prisma.offeringSession.findUniqueOrThrow({ where: { id: place.session.id } })).toMatchObject(
      {
        active: false,
        isDeleted: true,
      },
    );
    await expect(requestSessionBooking(seatsFor(place, 1))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("over HTTP only inside the business", async () => {
    const place = await placeWithSession("OFFLINE");
    const stranger = await signUp("Stranger");
    const refused = await call(sessionRoute.DELETE, {
      as: stranger,
      method: "DELETE",
      params: { businessId: place.business.id, sessionId: place.session.id },
    });
    expect(refused.status).toBe(404);
    expect(
      (await prisma.offeringSession.findUniqueOrThrow({ where: { id: place.session.id } })).isDeleted,
    ).toBe(false);
  });
});
