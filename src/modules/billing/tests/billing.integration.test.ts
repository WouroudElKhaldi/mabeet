import { createHmac, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as cron from "@/app/api/cron/expire-holds/route";
import * as callback from "@/app/api/payments/whish/callback/route";
import * as simulatorPay from "@/app/api/whish-simulator/pay/[code]/route";
import { ALL_PERMISSIONS } from "@/config/permissions";
import { runHousekeeping } from "@/modules/housekeeping/server";
import { env } from "@/server/env";
import { createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { call } from "@tests/integration/http";
import {
  assertPlanAllowsAnother,
  getBilling,
  handleStripeWebhook,
  openBillingPortal,
  settlePlanPayment,
  startCheckout,
  startWhishPlanCheckout,
} from "../server/billing-service";
import { sendWhishToTheApp } from "./whish-in-process";

// Host plans: the limits each plan sets, paying by card (Stripe's webhooks are signed and applied once) and by
// Whish (the simulator, end to end), and the housekeeping that ends a Whish month that ran out.

const SECRET = "whsec_test_secret";
const PRO_PRICE = "price_test_pro";
const BUSINESS_PRICE = "price_test_business";
const DAY_MS = 86_400_000;

const stripeSettings = {
  STRIPE_SECRET_KEY: "sk_test_mabeet",
  STRIPE_WEBHOOK_SECRET: SECRET,
  STRIPE_PRICE_PRO: PRO_PRICE,
  STRIPE_PRICE_BUSINESS: BUSINESS_PRICE,
};
const saved = {
  STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_PRO: env.STRIPE_PRICE_PRO,
  STRIPE_PRICE_BUSINESS: env.STRIPE_PRICE_BUSINESS,
  WHISH_MODE: env.WHISH_MODE,
};

beforeAll(() => {
  Object.assign(env, stripeSettings, { WHISH_MODE: "simulator" });
});
afterAll(() => {
  Object.assign(env, saved);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const businessOf = (id: string) => prisma.business.findUniqueOrThrow({ where: { id } });

const addRoom = (businessId: string) =>
  prisma.room.create({
    data: { businessId, name: `Room ${randomUUID()}`, baseRateCents: 9_000, exportToken: randomUUID() },
  });

describe("plan limits", () => {
  it("stops a Free place at its rooms, experiences and team size, counts only what is live, and lifts on Pro", async () => {
    const place = await createPlace();
    const id = place.business.id;

    const rooms = [await addRoom(id), await addRoom(id), await addRoom(id)];
    await expect(assertPlanAllowsAnother(id, "rooms")).rejects.toMatchObject({ code: "CONFLICT" });
    await prisma.room.update({ where: { id: rooms[0]!.id }, data: { isDeleted: true } });
    await expect(assertPlanAllowsAnother(id, "rooms")).resolves.toBeUndefined();

    await prisma.offering.create({
      data: {
        businessId: id,
        kind: "EXPERIENCE",
        slug: `hike-${randomUUID()}`,
        title: "Cedar hike",
        durationMinutes: 120,
        priceCents: 2_500,
      },
    });
    await expect(assertPlanAllowsAnother(id, "offerings")).rejects.toMatchObject({ code: "CONFLICT" });

    // The owner is the first of the two members a Free place has.
    await expect(assertPlanAllowsAnother(id, "members")).resolves.toBeUndefined();
    await memberWith(id, ["calendar.read"]);
    await expect(assertPlanAllowsAnother(id, "members")).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Your plan allows up to 2 team members, you included. Upgrade to add more.",
    });

    await prisma.business.update({ where: { id }, data: { plan: "PRO" } });
    await addRoom(id);
    for (const what of ["rooms", "offerings", "members"] as const) {
      await expect(assertPlanAllowsAnother(id, what)).resolves.toBeUndefined();
    }
  });

  it("shows the plan and what is used to whoever manages settings; only an owner can change it", async () => {
    const place = await createPlace();
    await addRoom(place.business.id);
    expect(await getBilling(place.ctx)).toMatchObject({
      plan: "FREE",
      limits: { rooms: 3, members: 2 },
      usage: { rooms: 1, offerings: 0, members: 1 },
      paysByCard: false,
      cardEnabled: true,
      whishEnabled: true,
      canManage: true,
    });
    const settingsEditor = await memberWith(place.business.id, ["settings.manage"]);
    expect(await getBilling(settingsEditor)).toMatchObject({ canManage: false });
    const frontDesk = await memberWith(place.business.id, ["bookings.read"]);
    await expect(getBilling(frontDesk)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("paying by card (Stripe)", () => {
  const signed = (body: string, secret = SECRET, at = Math.floor(Date.now() / 1000)) =>
    `t=${at},v1=${createHmac("sha256", secret).update(`${at}.${body}`).digest("hex")}`;
  const deliver = (event: object) => {
    const body = JSON.stringify(event);
    return handleStripeWebhook(body, signed(body));
  };
  const subscriptionEvent = (
    type: string,
    o: { businessId: string; subscription: string; customer: string; status: string; price?: string },
  ) => ({
    id: `evt_${randomUUID()}`,
    type,
    data: {
      object: {
        id: o.subscription,
        customer: o.customer,
        status: o.status,
        metadata: { businessId: o.businessId },
        items: { data: [{ price: { id: o.price ?? PRO_PRICE }, current_period_end: 1_900_000_000 }] },
      },
    },
  });

  it("lets only an owner start checkout, and sends a paying business to the billing portal instead", async () => {
    const place = await createPlace();
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ url: "https://checkout.stripe.com/c/test" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const manager = await memberWith(place.business.id, [...ALL_PERMISSIONS]);
    await expect(startCheckout(manager, "PRO")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fetchMock).not.toHaveBeenCalled();

    expect(await startCheckout(place.ctx, "BUSINESS")).toBe("https://checkout.stripe.com/c/test");
    const form = new URLSearchParams(String(fetchMock.mock.calls[0]![1].body));
    expect(form.get("line_items[0][price]")).toBe(BUSINESS_PRICE);
    expect(form.get("client_reference_id")).toBe(place.business.id);
    expect(form.get("customer_email")).toBe(place.owner.email);
    expect(
      await prisma.auditLog.count({
        where: { businessId: place.business.id, action: "billing.checkout_started" },
      }),
    ).toBe(1);
    // The plan only changes when Stripe confirms it.
    expect((await businessOf(place.business.id)).plan).toBe("FREE");

    await expect(openBillingPortal(place.ctx)).rejects.toMatchObject({ code: "VALIDATION" });
    await prisma.business.update({
      where: { id: place.business.id },
      data: { stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: `sub_${randomUUID()}` },
    });
    await expect(startCheckout(place.ctx, "PRO")).rejects.toMatchObject({ code: "CONFLICT" });
    fetchMock.mockImplementation(async () => Response.json({ url: "https://billing.stripe.com/p/test" }));
    expect(await openBillingPortal(place.ctx)).toBe("https://billing.stripe.com/p/test");
  });

  it("is turned off, calling nothing, when Stripe has no key", async () => {
    const place = await createPlace();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    env.STRIPE_SECRET_KEY = undefined;
    try {
      await expect(startCheckout(place.ctx, "PRO")).rejects.toMatchObject({ code: "UNAVAILABLE" });
      expect(await getBilling(place.ctx)).toMatchObject({ cardEnabled: false });
    } finally {
      env.STRIPE_SECRET_KEY = stripeSettings.STRIPE_SECRET_KEY;
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves a business to Pro, applies a replayed event once, and back to Free when the subscription ends", async () => {
    const place = await createPlace();
    const ids = {
      businessId: place.business.id,
      subscription: `sub_${randomUUID()}`,
      customer: `cus_${randomUUID()}`,
    };
    const created = subscriptionEvent("customer.subscription.created", { ...ids, status: "active" });
    expect(await deliver(created)).toBe("applied");
    expect(await deliver(created)).toBe("duplicate");
    expect(await businessOf(place.business.id)).toMatchObject({
      plan: "PRO",
      stripeCustomerId: ids.customer,
      stripeSubscriptionId: ids.subscription,
      planRenewsAt: new Date(1_900_000_000 * 1000),
    });

    // A card that stops paying (unpaid) loses the plan; an old subscription ending later changes nothing.
    expect(
      await deliver(subscriptionEvent("customer.subscription.updated", { ...ids, status: "unpaid" })),
    ).toBe("applied");
    expect((await businessOf(place.business.id)).plan).toBe("FREE");
    expect(
      await deliver(
        subscriptionEvent("customer.subscription.updated", {
          ...ids,
          status: "active",
          price: BUSINESS_PRICE,
        }),
      ),
    ).toBe("applied");
    expect((await businessOf(place.business.id)).plan).toBe("BUSINESS");
    expect(
      await deliver(
        subscriptionEvent("customer.subscription.deleted", {
          ...ids,
          subscription: `sub_${randomUUID()}`,
          status: "canceled",
        }),
      ),
    ).toBe("applied");
    expect((await businessOf(place.business.id)).plan).toBe("BUSINESS");

    expect(
      await deliver(subscriptionEvent("customer.subscription.deleted", { ...ids, status: "canceled" })),
    ).toBe("applied");
    expect(await businessOf(place.business.id)).toMatchObject({
      plan: "FREE",
      stripeSubscriptionId: null,
      planRenewsAt: null,
    });
  });

  it("records each paid invoice once as plan revenue", async () => {
    const place = await createPlace();
    const customer = `cus_${randomUUID()}`;
    await prisma.business.update({ where: { id: place.business.id }, data: { stripeCustomerId: customer } });
    const invoice = {
      id: `evt_${randomUUID()}`,
      type: "invoice.paid",
      data: {
        object: {
          id: `in_${randomUUID()}`,
          customer,
          amount_paid: 2_000,
          currency: "usd",
          lines: { data: [{ pricing: { price_details: { price: BUSINESS_PRICE } } }] },
        },
      },
    };
    expect(await deliver(invoice)).toBe("applied");
    expect(await deliver(invoice)).toBe("duplicate");
    const payments = await prisma.planPayment.findMany({ where: { businessId: place.business.id } });
    expect(payments).toEqual([
      expect.objectContaining({
        plan: "BUSINESS",
        amountCents: 2_000,
        currency: "USD",
        method: "STRIPE",
        status: "PAID",
        providerRef: invoice.data.object.id,
      }),
    ]);
  });

  it("keeps nothing of an event that fails halfway, so Stripe's retry can apply it", async () => {
    const place = await createPlace();
    const customer = `cus_${randomUUID()}`;
    await prisma.business.update({ where: { id: place.business.id }, data: { stripeCustomerId: customer } });
    const invoiceId = `in_${randomUUID()}`;
    const paid = (eventId: string) => ({
      id: eventId,
      type: "invoice.paid",
      data: { object: { id: invoiceId, customer, amount_paid: 1_000, currency: "usd" } },
    });
    expect(await deliver(paid(`evt_${randomUUID()}`))).toBe("applied");

    // A second event for the same invoice: recording it fails after the event row was written.
    const failing = `evt_${randomUUID()}`;
    await expect(deliver(paid(failing))).rejects.toThrow();
    expect(await prisma.webhookEvent.count({ where: { provider: "stripe", eventId: failing } })).toBe(0);
    expect(await prisma.planPayment.count({ where: { providerRef: invoiceId } })).toBe(1);
  });

  it("rejects an unsigned or wrongly signed event without touching anything", async () => {
    const place = await createPlace();
    const forged = subscriptionEvent("customer.subscription.created", {
      businessId: place.business.id,
      subscription: `sub_${randomUUID()}`,
      customer: `cus_${randomUUID()}`,
      status: "active",
    });
    const body = JSON.stringify(forged);
    expect(await handleStripeWebhook(body, "t=1,v1=bad")).toBe("rejected");
    expect(await handleStripeWebhook(body, signed(body, "whsec_someone_else"))).toBe("rejected");
    expect(await handleStripeWebhook(body, null)).toBe("rejected");
    expect((await businessOf(place.business.id)).plan).toBe("FREE");
    expect(await prisma.webhookEvent.count({ where: { eventId: forged.id } })).toBe(0);
  });
});

describe("paying by Whish (the simulator, end to end)", () => {
  const codeOf = (url: string) => new URL(url).pathname.split("/").pop()!;
  const payOnSimulator = (url: string, otp: string) =>
    call(simulatorPay.POST, {
      params: { code: codeOf(url) },
      body: { phone: "+961 70 123 456", otp },
    });

  it("buys a month of Pro: a wrong code changes nothing, the right one starts the plan, a second month follows on", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const place = await createPlace();
    sendWhishToTheApp();

    const url = await startWhishPlanCheckout(place.ctx, "PRO");
    expect(url).toMatch(/\/whish-simulator\/pay\/[\w-]+$/);
    const [pending] = await prisma.planPayment.findMany({ where: { businessId: place.business.id } });
    expect(pending).toMatchObject({
      plan: "PRO",
      amountCents: 1_000,
      currency: "USD",
      method: "WHISH",
      status: "PENDING",
      checkoutUrl: url,
      paidById: place.owner.id,
    });

    expect((await payOnSimulator(url, "000000")).body).toEqual({ ok: false, redirect: null });
    expect((await businessOf(place.business.id)).plan).toBe("FREE");
    expect((await prisma.planPayment.findUniqueOrThrow({ where: { id: pending!.id } })).status).toBe(
      "PENDING",
    );

    const before = Date.now();
    const paid = await payOnSimulator(url, "111111");
    expect(paid.body).toMatchObject({ ok: true });
    const business = await businessOf(place.business.id);
    expect(business.plan).toBe("PRO");
    expect(business.planRenewsAt!.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY_MS - 1_000);
    expect(await prisma.planPayment.findUniqueOrThrow({ where: { id: pending!.id } })).toMatchObject({
      status: "PAID",
      paidAt: expect.any(Date),
    });

    // Whish calling again, or anyone calling the callback, adds nothing.
    const replay = await call(callback.GET, { query: { plan: pending!.id } });
    expect(replay).toEqual({ status: 200, body: { ok: true, result: "paid" } });
    expect((await businessOf(place.business.id)).planRenewsAt).toEqual(business.planRenewsAt);

    const second = await startWhishPlanCheckout(place.ctx, "PRO");
    await payOnSimulator(second, "111111");
    expect((await businessOf(place.business.id)).planRenewsAt!.getTime()).toBe(
      business.planRenewsAt!.getTime() + 30 * DAY_MS,
    );
  });

  it("lets only an owner pay, and sends a card subscriber to the billing portal", async () => {
    const place = await createPlace();
    sendWhishToTheApp();
    const manager = await memberWith(place.business.id, [...ALL_PERMISSIONS]);
    await expect(startWhishPlanCheckout(manager, "PRO")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await prisma.business.update({
      where: { id: place.business.id },
      data: { stripeSubscriptionId: `sub_${randomUUID()}` },
    });
    await expect(startWhishPlanCheckout(place.ctx, "PRO")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.planPayment.count({ where: { businessId: place.business.id } })).toBe(0);
  });

  it("leaves nothing waiting, and the plan as it was, when Whish is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const place = await createPlace();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ status: false, code: "500", dialog: null, actions: null, extra: null, data: null }),
      ),
    );
    await expect(startWhishPlanCheckout(place.ctx, "BUSINESS")).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    expect(await businessOf(place.business.id)).toMatchObject({ plan: "FREE", planRenewsAt: null });
    const payments = await prisma.planPayment.findMany({ where: { businessId: place.business.id } });
    expect(payments.map((payment) => payment.status)).toEqual(["FAILED"]);
    await expect(settlePlanPayment(payments[0]!.id)).resolves.toBe("failed");
  });
});

describe("housekeeping", () => {
  it("ends a Whish month that ran out, leaves card plans to Stripe, and checks a payment whose callback was lost", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendWhishToTheApp();
    const now = new Date();

    const lapsed = await createPlace();
    await prisma.business.update({
      where: { id: lapsed.business.id },
      data: { plan: "PRO", planRenewsAt: new Date(now.getTime() - DAY_MS) },
    });
    const byCard = await createPlace();
    await prisma.business.update({
      where: { id: byCard.business.id },
      data: {
        plan: "BUSINESS",
        planRenewsAt: new Date(now.getTime() - DAY_MS),
        stripeSubscriptionId: `sub_${randomUUID()}`,
      },
    });

    // Paid on Whish, but the callback never reached us.
    const lost = await createPlace();
    await startWhishPlanCheckout(lost.ctx, "PRO");
    const payment = await prisma.planPayment.findFirstOrThrow({ where: { businessId: lost.business.id } });
    await prisma.whishSandboxPayment.update({
      where: { externalId: payment.id },
      data: { status: "success", payerPhone: "96170123456" },
    });

    // Too recent to be stale: its callback may still be on its way.
    await runHousekeeping(now);
    expect((await businessOf(lost.business.id)).plan).toBe("FREE");

    const later = new Date(now.getTime() + 3 * 60_000);
    const result = await runHousekeeping(later);
    expect(result.plans.checked).toBeGreaterThanOrEqual(1);
    expect(await businessOf(lapsed.business.id)).toMatchObject({ plan: "FREE", planRenewsAt: null });
    expect((await businessOf(byCard.business.id)).plan).toBe("BUSINESS");
    expect((await businessOf(lost.business.id)).plan).toBe("PRO");
  });

  it("runs on demand only with the cron secret", async () => {
    const refused = await call(cron.POST, { method: "POST" });
    expect(refused.status).toBe(401);

    sendWhishToTheApp();
    const request = new Request("http://localhost/api/cron/expire-holds", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const response = await cron.POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ plans: { expiredPlans: expect.any(Number) } });
  });
});
