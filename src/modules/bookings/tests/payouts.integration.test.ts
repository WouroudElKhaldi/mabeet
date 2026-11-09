import { describe, expect, it } from "vitest";
import { decidePayout, getPayoutQueue } from "@/modules/payments/server";
import { resolveContext, resolvePlatformActor } from "@/server/auth/resolve-context";
import { createPlatformAdmin, createUser, memberWith, prisma, stay } from "@tests/integration/helpers";
import { addDays, todayUtc } from "@/utils/dates";
import {
  getHostBalances,
  getPayouts,
  listRefundsToSend,
  markRefundSent,
  requestBooking,
  requestPayout,
} from "../server";
import { placeWithRoom, requestFor } from "./fixtures";

// Payouts: only money for confirmed stays that have started can be asked for, never more than is there, even with
// many requests at once; an admin sends each one by hand and marks it once. Money is never doubled or lost.

type Place = Awaited<ReturnType<typeof placeWithRoom>>;

/** A booking paid online in full, confirmed, and started `daysAgo` days ago (negative: still ahead). */
async function paidStay(place: Place, totalCents: number, daysAgo: number, offset: number) {
  const booking = await requestBooking(requestFor(place, stay(offset, 1)));
  const checkIn = addDays(todayUtc(), -daysAgo);
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED", checkIn, checkOut: addDays(checkIn, 1) },
  });
  return prisma.payment.create({
    data: {
      businessId: place.business.id,
      bookingId: booking.id,
      amountCents: totalCents,
      currency: "USD",
      method: "WHISH",
      status: "PAID",
      paidAt: new Date(),
    },
  });
}

const toWhish = (amountCents: number) => ({
  amountCents,
  currency: "USD",
  method: "WHISH" as const,
  accountName: "Rima Khoury",
  whishPhone: "+96170123456",
});

const usd = async (place: Place) =>
  (await getPayouts(place.ctx)).balances.find((row) => row.currency === "USD");

describe("what a host can be paid out", () => {
  it("releases only confirmed stays that have started, net of refunds", async () => {
    const place = await placeWithRoom("AUTOMATIC");
    await paidStay(place, 20_000, 1, 10);
    await paidStay(place, 5_000, -5, 20);
    const refunded = await paidStay(place, 7_000, 2, 30);
    await prisma.payment.update({
      where: { id: refunded.id },
      data: { status: "REFUNDED", refundedCents: 7_000 },
    });
    expect(await usd(place)).toMatchObject({
      earnedCents: 20_000,
      upcomingCents: 5_000,
      availableCents: 20_000,
    });
  });

  it("is for owners only", async () => {
    const place = await placeWithRoom("AUTOMATIC");
    const staff = await memberWith(place.business.id, [
      "bookings.read",
      "bookings.decide",
      "settings.manage",
    ]);
    await expect(getPayouts(staff)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requestPayout(staff, toWhish(100))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("is never asked for by a platform admin visiting the business", async () => {
    const place = await placeWithRoom("AUTOMATIC");
    await paidStay(place, 10_000, 1, 10);
    const admin = await createPlatformAdmin();
    const visiting = await resolveContext(admin.userId, place.business.id);
    if (!visiting) throw new Error("expected the admin to open the business");
    await expect(requestPayout(visiting, toWhish(1_000))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("asking for a payout", () => {
  it("refuses more than is available, and lets only one of 20 requests at once take it", async () => {
    const place = await placeWithRoom("AUTOMATIC");
    await paidStay(place, 30_000, 1, 10);
    await expect(requestPayout(place.ctx, toWhish(30_001))).rejects.toMatchObject({ code: "CONFLICT" });

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => requestPayout(place.ctx, toWhish(30_000))),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.payout.count({ where: { businessId: place.business.id } })).toBe(1);
    expect(await usd(place)).toMatchObject({ requestedCents: 30_000, availableCents: 0 });
  });

  it("keeps only the details of the way it is sent", async () => {
    const place = await placeWithRoom("AUTOMATIC");
    await paidStay(place, 10_000, 1, 10);
    const payout = await requestPayout(place.ctx, {
      ...toWhish(4_000),
      method: "BANK_TRANSFER",
      bankName: "Bank Audi",
      iban: "LB62099900000001001901229114",
    });
    expect(payout).toMatchObject({ method: "BANK_TRANSFER", whishPhone: null, bankName: "Bank Audi" });
    expect((await getPayouts(place.ctx)).lastDetails).toMatchObject({ method: "BANK_TRANSFER" });
  });
});

/** A refund still waiting, recorded `hoursAgo` hours ago. */
async function pendingRefund(place: Place, paymentId: string, hoursAgo: number) {
  return prisma.refund.create({
    data: {
      businessId: place.business.id,
      paymentId,
      amountCents: 8_000,
      currency: "USD",
      status: "PENDING",
      reason: "Cancelled by the host",
      createdAt: new Date(Date.now() - hoursAgo * 60 * 60_000),
    },
  });
}

describe("what the admin sees to send", () => {
  it("lists the payouts asked for, what each host is owed, and only refunds housekeeping stopped retrying", async () => {
    const place = await placeWithRoom("AUTOMATIC");
    await paidStay(place, 10_000, 1, 10);
    const admin = await createPlatformAdmin();
    const asked = await requestPayout(place.ctx, toWhish(3_000));

    const queue = await getPayoutQueue(admin);
    expect(queue.requests.find((payout) => payout.id === asked.id)?.business.name).toBe(place.business.name);
    expect(
      (await getHostBalances(admin)).find(
        (row) => row.businessId === place.business.id && row.currency === "USD",
      ),
    ).toMatchObject({ earnedCents: 10_000, requestedCents: 3_000, availableCents: 7_000 });

    const payment = await paidStay(place, 8_000, -3, 20);
    const fresh = await pendingRefund(place, payment.id, 1);
    const stuck = await pendingRefund(place, payment.id, 30);
    const toSend = (await listRefundsToSend(admin)).map((refund) => refund.id);
    expect(toSend).toContain(stuck.id);
    expect(toSend).not.toContain(fresh.id);
  });
});

describe("the admin sends payouts and refunds by hand", () => {
  it("marks a payout sent once; a refused one is available again", async () => {
    const place = await placeWithRoom("AUTOMATIC");
    await paidStay(place, 10_000, 1, 10);
    const admin = await createPlatformAdmin();
    const first = await requestPayout(place.ctx, toWhish(6_000));
    await decidePayout(admin, first.id, { action: "paid", reference: "WH-123" });
    await expect(decidePayout(admin, first.id, { action: "rejected" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await usd(place)).toMatchObject({ paidOutCents: 6_000, availableCents: 4_000 });
    expect(await prisma.auditLog.count({ where: { entityId: first.id, action: "payout.sent" } })).toBe(1);

    const second = await requestPayout(place.ctx, toWhish(4_000));
    await decidePayout(admin, second.id, { action: "rejected", note: "The Whish number did not answer" });
    expect(await usd(place)).toMatchObject({ availableCents: 4_000 });
  });

  it("never treats someone else as an admin", async () => {
    const user = await createUser("Not an admin");
    expect(await resolvePlatformActor(user.id)).toBeNull();
  });

  it("marks a refund sent by hand once", async () => {
    const place = await placeWithRoom("AUTOMATIC");
    const payment = await paidStay(place, 8_000, -3, 10);
    const refund = await prisma.refund.create({
      data: {
        businessId: place.business.id,
        paymentId: payment.id,
        amountCents: 8_000,
        currency: "USD",
        status: "PENDING",
        reason: "Cancelled by the host",
      },
    });
    const admin = await createPlatformAdmin();
    await markRefundSent(admin, refund.id, "WH-REF-9");
    expect(await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({
      status: "DONE",
      providerRef: "WH-REF-9",
      doneById: admin.userId,
    });
    await expect(markRefundSent(admin, refund.id, null)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
