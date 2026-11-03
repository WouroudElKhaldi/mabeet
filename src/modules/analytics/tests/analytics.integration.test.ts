import { describe, expect, it } from "vitest";
import * as analyticsRoute from "@/app/api/workspaces/[businessId]/analytics/route";
import { addRoom, createPlace, createUser, memberWith, prisma, stay } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { addBlock, confirmBooking, requestBooking } from "@/modules/bookings/server";
import { createWorkspace } from "@/modules/workspaces/server";
import { resolveContext } from "@/server/auth/resolve-context";
import { toIsoDate } from "@/utils/dates";
import { getAnalytics, getBusinessReport, getPlacesOverview, getSavings } from "../server";

// The numbers hosts are shown on the real database: only confirmed direct stays earn, money saved is revenue times
// the place's own commission rate, nights add up by channel, currencies are never mixed, and another business's
// stays are never counted.

/** The next 60 days, today included: the period every test reads. */
const period = () => ({ checkIn: stay(0, 1).checkIn, checkOut: stay(60, 1).checkIn });

async function placeWithRoom(currency = "USD", rateBps = 1500) {
  const place = await createPlace();
  await prisma.business.update({
    where: { id: place.business.id },
    data: { currency, commissionRateBps: rateBps, bookingMode: "OFFLINE" },
  });
  const room = await addRoom(place.business.id, { capacity: 2, baseRateCents: 10_000 });
  const guest = await createUser("Maya Haddad");
  return { ...place, room, guest };
}

type Place = Awaited<ReturnType<typeof placeWithRoom>>;

async function book(place: Place, fromToday: number, nights: number, { confirm = true } = {}) {
  const booking = await requestBooking({
    businessSlug: place.business.slug,
    roomId: place.room.id,
    range: stay(fromToday, nights),
    guestCount: 2,
    guestName: "Maya Haddad",
    guestPhone: "+96171123456",
    guestEmail: null,
    guestNote: null,
    guestUserId: place.guest.id,
  });
  if (confirm) await confirmBooking(place.ctx, { bookingId: booking.id });
  return booking;
}

describe("a place's report", () => {
  it("earns only from confirmed direct stays, and saves its own commission rate of them", async () => {
    const place = await placeWithRoom("USD", 1500);
    await book(place, 5, 2);
    await book(place, 10, 3, { confirm: false });
    await addBlock(place.ctx, { roomId: place.room.id, range: stay(20, 4), note: "Painting" });

    const report = await getBusinessReport(place.ctx, period());
    expect(report).toMatchObject({
      currency: "USD",
      directRevenueCents: 20_000,
      commissionSavedCents: 3_000,
      averageDailyRateCents: 10_000,
      nightsSold: 6,
      nightsAvailable: 60,
      occupancyRate: 0.1,
      requests: { CONFIRMED: 1, HELD: 1 },
    });
    expect(report.channels).toEqual(
      expect.arrayContaining([
        { channel: "MANUAL", nights: 4 },
        { channel: "DIRECT", nights: 2 },
      ]),
    );
    expect(report.monthly.reduce((sum, month) => sum + month.nights, 0)).toBe(6);
  });

  it("counts only the nights inside the period, and never another business's", async () => {
    const place = await placeWithRoom();
    await book(place, 58, 4);
    const other = await placeWithRoom();
    await book(other, 5, 5);

    const report = await getBusinessReport(place.ctx, period());
    // Two of the four nights fall inside the 60 days: half the stay's price.
    expect(report).toMatchObject({ nightsSold: 2, directRevenueCents: 20_000 });
  });

  it("needs analytics.read", async () => {
    const place = await placeWithRoom();
    const frontDesk = await memberWith(place.business.id, ["bookings.read", "bookings.decide"]);
    await expect(getBusinessReport(frontDesk, period())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getSavings(frontDesk)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("savings and totals", () => {
  it("adds up everything since the place joined, against what it paid for plans", async () => {
    const place = await placeWithRoom("USD", 2000);
    await book(place, 5, 2);
    await prisma.planPayment.create({
      data: {
        businessId: place.business.id,
        plan: "PRO",
        amountCents: 1_000,
        currency: "USD",
        method: "STRIPE",
        providerRef: `test-${place.business.id}`,
        status: "PAID",
      },
    });
    expect(await getSavings(place.ctx)).toEqual({
      savings: [{ currency: "USD", directRevenueCents: 20_000, commissionSavedCents: 4_000 }],
      planFees: [{ currency: "USD", cents: 1_000 }],
    });
  });

  it("adds an owner's places up without ever mixing currencies", async () => {
    const owner = await signUp("Nour Haddad");
    const dollars = await createWorkspace(owner.userId, { name: "Beit Dollars" });
    const pounds = await createWorkspace(owner.userId, { name: "Beit Lira" });
    await prisma.business.update({ where: { id: pounds.id }, data: { currency: "LBP" } });
    const guest = await createUser("Guest");
    const contexts = [];
    for (const [business, rate] of [
      [dollars, 10_000],
      [pounds, 9_000_000],
    ] as const) {
      const room = await addRoom(business.id, { baseRateCents: rate });
      const placeCtx = await resolveContext(owner.userId, business.id);
      if (!placeCtx) throw new Error("expected the owner's context");
      contexts.push(placeCtx);
      const booking = await requestBooking({
        businessSlug: business.slug,
        roomId: room.id,
        range: stay(5, 1),
        guestCount: 1,
        guestName: "Guest",
        guestPhone: "+96171123456",
        guestEmail: null,
        guestNote: null,
        guestUserId: guest.id,
      });
      await confirmBooking(placeCtx, { bookingId: booking.id });
    }
    const [ctx] = contexts;
    if (!ctx) throw new Error("expected the owner's context");

    const all = await getAnalytics(ctx, "all", period());
    expect(all.places.map((place) => place.name).sort()).toEqual(["Beit Dollars", "Beit Lira"]);
    expect(all.totals.revenue).toEqual([
      { currency: "LBP", cents: 9_000_000 },
      { currency: "USD", cents: 10_000 },
    ]);
    expect(all.totals.nightsSold).toBe(2);
    expect((await getAnalytics(ctx, "place", period())).places).toHaveLength(1);
  });
});

describe("all my places", () => {
  it("shows today's numbers where the person may read bookings, and the place alone elsewhere", async () => {
    const place = await placeWithRoom();
    await book(place, 0, 2);
    await book(place, 3, 1, { confirm: false });
    const elsewhere = await createPlace();
    const role = await prisma.role.create({
      data: {
        businessId: elsewhere.business.id,
        name: `Cleaner ${place.business.id}`,
        permissions: ["calendar.read"],
      },
    });
    await prisma.membership.create({
      data: { userId: place.owner.id, businessId: elsewhere.business.id, roleId: role.id },
    });

    const overview = await getPlacesOverview(place.owner.id);
    expect(overview.find((row) => row.id === place.business.id)?.stats).toMatchObject({
      waiting: 1,
      arrivingToday: 1,
      inHouse: 1,
    });
    expect(overview.find((row) => row.id === elsewhere.business.id)?.stats).toBeNull();
  });
});

describe("the analytics route", () => {
  it("answers the place's report for its period, and 404 to anyone outside the place", async () => {
    const owner = await signUp("Owner");
    const business = await createWorkspace(owner.userId, { name: "Beit Route" });
    const from = toIsoDate(stay(0, 1).checkIn);
    const to = toIsoDate(stay(10, 1).checkIn);
    const mine = await call(analyticsRoute.GET, {
      as: owner,
      params: { businessId: business.id },
      query: { from, to },
    });
    expect(mine).toMatchObject({ status: 200, body: { range: { from, to }, nightsSold: 0 } });

    const stranger = await signUp("Stranger");
    expect(
      (await call(analyticsRoute.GET, { as: stranger, params: { businessId: business.id } })).status,
    ).toBe(404);
    expect(
      (
        await call(analyticsRoute.GET, {
          as: owner,
          params: { businessId: business.id },
          query: { from: to, to: from },
        })
      ).status,
    ).toBe(400);
  });
});
