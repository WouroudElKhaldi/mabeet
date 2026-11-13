import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ALL_PERMISSIONS } from "@/config/permissions";
import { PLAN_MONTH_MS } from "@/config/plans";
import { runHousekeeping } from "@/modules/housekeeping/server";
import { env } from "@/server/env";
import { createPlace, createPlatformAdmin, memberWith, prisma } from "@tests/integration/helpers";
import { sendPaymentsToTheApp } from "@tests/integration/payments-in-process";
import { offerInput } from "../schemas";
import { claimFreeOffer, createOffer, endOffer, listOffersForAdmin } from "../server/offer-service";
import { getBilling, startCheckout, startWhishPlanCheckout } from "../server/billing-service";

// Plan offers: an admin gives hosts a plan free or a share off it, for every place or one, during each place's first
// months or between two dates. A free offer is taken from the billing page and runs out like a paid Whish month; a
// percent-off offer lowers what the checkout charges, on Whish and by card.

const DAY_MS = 86_400_000;
const saved = {
  STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
  STRIPE_PRICE_PRO: env.STRIPE_PRICE_PRO,
  STRIPE_PRICE_BUSINESS: env.STRIPE_PRICE_BUSINESS,
  WHISH_MODE: env.WHISH_MODE,
};

beforeAll(() => {
  Object.assign(env, {
    STRIPE_SECRET_KEY: "sk_test_mabeet",
    STRIPE_PRICE_PRO: "price_test_pro",
    STRIPE_PRICE_BUSINESS: "price_test_business",
    WHISH_MODE: "simulator",
  });
});
afterAll(() => {
  Object.assign(env, saved);
});
// An offer for every place would reach the other tests' places, so each test ends the offers it made.
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await prisma.planOffer.updateMany({ where: { isDeleted: false }, data: { isDeleted: true } });
});

const offer = (fields: Record<string, unknown>) =>
  offerInput.parse({ name: "Welcome months", plan: "PRO", kind: "FREE", ...fields });

const businessOf = (id: string) => prisma.business.findUniqueOrThrow({ where: { id } });

async function joinedDaysAgo(businessId: string, days: number) {
  await prisma.business.update({
    where: { id: businessId },
    data: { createdAt: new Date(Date.now() - days * DAY_MS) },
  });
}

describe("making an offer", () => {
  it("refuses a half-filled offer, both kinds of timing at once, and dates already past", async () => {
    const admin = await createPlatformAdmin();
    const parse = (fields: Record<string, unknown>) =>
      offerInput.safeParse({ name: "Welcome", plan: "PRO", kind: "FREE", ...fields }).success;

    expect(parse({ firstMonths: 3 })).toBe(true);
    expect(parse({ startsOn: "2030-01-01", lastDay: "2030-01-31" })).toBe(true);
    expect(parse({})).toBe(false);
    expect(parse({ firstMonths: 3, startsOn: "2030-01-01", lastDay: "2030-01-31" })).toBe(false);
    expect(parse({ startsOn: "2030-01-01" })).toBe(false);
    expect(parse({ startsOn: "2030-02-01", lastDay: "2030-01-31" })).toBe(false);
    expect(parse({ firstMonths: 3, percentOff: 50 })).toBe(false);
    expect(parse({ firstMonths: 3, kind: "PERCENT_OFF" })).toBe(false);
    expect(parse({ firstMonths: 3, plan: "FREE" })).toBe(false);

    await expect(
      createOffer(admin, offer({ startsOn: "2020-01-01", lastDay: "2020-01-31" })),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      createOffer(admin, offer({ firstMonths: 1, businessId: "00000000-0000-4000-8000-000000000000" })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is logged as the admin's action", async () => {
    const admin = await createPlatformAdmin();
    const made = await createOffer(admin, offer({ firstMonths: 1 }));
    expect(
      await prisma.auditLog.count({
        where: { entityId: made.id, action: "plan_offer.created", actorId: admin.userId },
      }),
    ).toBe(1);
  });

  it("is refused by the database when half-filled, whatever writes it", async () => {
    const admin = await createPlatformAdmin();
    const base = { name: "Raw", plan: "PRO" as const, createdById: admin.userId };
    await expect(prisma.planOffer.create({ data: { ...base, kind: "FREE" } })).rejects.toThrow();
    await expect(
      prisma.planOffer.create({ data: { ...base, kind: "PERCENT_OFF", firstMonths: 2 } }),
    ).rejects.toThrow();
    await expect(
      prisma.planOffer.create({ data: { ...base, plan: "FREE", kind: "FREE", firstMonths: 2 } }),
    ).rejects.toThrow();
  });
});

describe("a free offer", () => {
  it("is open to a new place, not to one that joined before its months, and is taken once", async () => {
    const admin = await createPlatformAdmin();
    const made = await createOffer(admin, offer({ firstMonths: 3 }));
    const fresh = await createPlace();
    const old = await createPlace();
    await joinedDaysAgo(old.business.id, 120);

    expect((await getBilling(old.ctx)).offers).toEqual([]);
    const [open] = (await getBilling(fresh.ctx)).offers;
    expect(open).toMatchObject({ id: made.id, kind: "FREE", plan: "PRO", monthlyCents: 0 });

    const { createdAt } = await businessOf(fresh.business.id);
    const claimed = await claimFreeOffer(fresh.ctx, made.id);
    expect(claimed.until.getTime()).toBe(createdAt.getTime() + 3 * PLAN_MONTH_MS);
    expect(await businessOf(fresh.business.id)).toMatchObject({ plan: "PRO", planRenewsAt: claimed.until });
    expect((await getBilling(fresh.ctx)).offers).toEqual([]);
    await expect(claimFreeOffer(fresh.ctx, made.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(claimFreeOffer(old.ctx, made.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect((await listOffersForAdmin(admin)).offers.find((row) => row.id === made.id)).toMatchObject({
      state: "running",
      claims: 1,
      placeName: null,
    });
  });

  it("for one host is seen by that place only, and ending it hides it", async () => {
    const admin = await createPlatformAdmin();
    const chosen = await createPlace();
    const other = await createPlace();
    const today = new Date().toISOString().slice(0, 10);
    const lastDay = new Date(Date.now() + 30 * DAY_MS).toISOString().slice(0, 10);
    const made = await createOffer(
      admin,
      offer({ plan: "BUSINESS", businessId: chosen.business.id, startsOn: today, lastDay }),
    );

    expect((await getBilling(other.ctx)).offers).toEqual([]);
    expect((await getBilling(chosen.ctx)).offers).toHaveLength(1);

    await endOffer(admin, made.id);
    expect((await getBilling(chosen.ctx)).offers).toEqual([]);
    await expect(claimFreeOffer(chosen.ctx, made.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(endOffer(admin, made.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listOffersForAdmin(admin)).offers.find((row) => row.id === made.id)).toMatchObject({
      state: "ended",
      placeName: chosen.business.name,
    });
  });

  it("is refused to a card payer, to a bigger plan, and to anyone but an owner", async () => {
    const admin = await createPlatformAdmin();
    const made = await createOffer(admin, offer({ firstMonths: 2 }));

    const byCard = await createPlace();
    await prisma.business.update({
      where: { id: byCard.business.id },
      data: { plan: "PRO", stripeSubscriptionId: `sub_${randomUUID()}` },
    });
    await expect(claimFreeOffer(byCard.ctx, made.id)).rejects.toMatchObject({ code: "CONFLICT" });

    const bigger = await createPlace();
    await prisma.business.update({
      where: { id: bigger.business.id },
      data: { plan: "BUSINESS", planRenewsAt: new Date(Date.now() + 10 * DAY_MS) },
    });
    await expect(claimFreeOffer(bigger.ctx, made.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.planOfferClaim.count({ where: { offerId: made.id } })).toBe(0);

    const place = await createPlace();
    const manager = await memberWith(place.business.id, [...ALL_PERMISSIONS]);
    await expect(claimFreeOffer(manager, made.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ends with its months: housekeeping puts the place back on Free", async () => {
    const admin = await createPlatformAdmin();
    const made = await createOffer(admin, offer({ firstMonths: 1 }));
    const place = await createPlace();
    const { until } = await claimFreeOffer(place.ctx, made.id);

    await runHousekeeping(new Date(until.getTime() - DAY_MS));
    expect((await businessOf(place.business.id)).plan).toBe("PRO");
    await runHousekeeping(new Date(until.getTime() + DAY_MS));
    expect(await businessOf(place.business.id)).toMatchObject({ plan: "FREE", planRenewsAt: null });
  });
});

describe("a percent-off offer", () => {
  it("lowers a Whish month and the payment remembers the offer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendPaymentsToTheApp();
    const admin = await createPlatformAdmin();
    await createOffer(
      admin,
      offer({ kind: "PERCENT_OFF", percentOff: 40, firstMonths: 2, plan: "BUSINESS" }),
    );
    const best = await createOffer(admin, offer({ kind: "PERCENT_OFF", percentOff: 50, firstMonths: 2 }));
    const place = await createPlace();

    const offers = (await getBilling(place.ctx)).offers;
    expect(offers.find((open) => open.id === best.id)).toMatchObject({ monthlyCents: 2_500 });
    await expect(claimFreeOffer(place.ctx, best.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    await startWhishPlanCheckout(place.ctx, "PRO");
    const payment = await prisma.planPayment.findFirstOrThrow({ where: { businessId: place.business.id } });
    expect(payment).toMatchObject({ plan: "PRO", amountCents: 2_500, offerId: best.id });

    const other = await createPlace();
    await joinedDaysAgo(other.business.id, 90);
    await startWhishPlanCheckout(other.ctx, "PRO");
    expect(
      await prisma.planPayment.findFirstOrThrow({ where: { businessId: other.business.id } }),
    ).toMatchObject({ amountCents: 5_000, offerId: null });
  });

  it("puts a coupon on a card checkout for the months it has left", async () => {
    const admin = await createPlatformAdmin();
    await createOffer(
      admin,
      offer({ name: "Half off", kind: "PERCENT_OFF", percentOff: 50, firstMonths: 3 }),
    );
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ id: "coupon_test", url: "https://checkout.stripe.com/c/test" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const place = await createPlace();

    await startCheckout(place.ctx, "PRO");
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/coupons$/);
    const coupon = new URLSearchParams(String(fetchMock.mock.calls[0]![1].body));
    expect(coupon.get("percent_off")).toBe("50");
    expect(coupon.get("duration_in_months")).toBe("3");
    expect(coupon.get("max_redemptions")).toBe("1");
    const checkout = new URLSearchParams(String(fetchMock.mock.calls[1]![1].body));
    expect(checkout.get("discounts[0][coupon]")).toBe("coupon_test");

    fetchMock.mockClear();
    await startCheckout(place.ctx, "BUSINESS");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(String(fetchMock.mock.calls[0]![1].body)).has("discounts[0][coupon]")).toBe(
      false,
    );
  });
});
