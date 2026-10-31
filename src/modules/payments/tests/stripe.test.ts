import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ STRIPE_SECRET_KEY: "sk_test_1" as string | undefined }));
vi.mock("@/server/env", () => ({ env }));

const { createSubscriptionCheckout, createBillingPortalSession, verifyWebhookSignature } =
  await import("../server/stripe");

const SECRET = "whsec_test_secret";
const signed = (body: string, secret = SECRET, at = Math.floor(Date.now() / 1000)) =>
  `t=${at},v1=${createHmac("sha256", secret).update(`${at}.${body}`).digest("hex")}`;

const checkout = {
  priceId: "price_pro",
  businessId: "biz_1",
  customerId: null,
  email: "owner@guesthouse.lb",
  successUrl: "https://mabeet.example/dashboard/biz_1/billing?checkout=done",
  cancelUrl: "https://mabeet.example/dashboard/biz_1/billing",
};

afterEach(() => {
  vi.unstubAllGlobals();
  env.STRIPE_SECRET_KEY = "sk_test_1";
});

describe("Stripe webhook signatures", () => {
  it("accepts the right secret, an untouched body and a recent timestamp, and nothing else", () => {
    const body = '{"id":"evt_1"}';
    expect(verifyWebhookSignature(body, signed(body), SECRET)).toBe(true);
    expect(verifyWebhookSignature(body, signed(body, "whsec_other"), SECRET)).toBe(false);
    expect(verifyWebhookSignature('{"id":"evt_2"}', signed(body), SECRET)).toBe(false);
    expect(
      verifyWebhookSignature(body, signed(body, SECRET, Math.floor(Date.now() / 1000) - 3600), SECRET),
    ).toBe(false);
    expect(verifyWebhookSignature(body, "t=1,v1=bad", SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
  });
});

describe("Stripe client", () => {
  it("starts a subscription checkout that carries the business id to the webhook", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ url: "https://checkout.stripe.com/c/1" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await createSubscriptionCheckout(checkout)).toEqual({ url: "https://checkout.stripe.com/c/1" });
    const [called, init] = fetchMock.mock.calls[0]!;
    expect(called).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init.headers).toMatchObject({ authorization: "Bearer sk_test_1" });
    const form = new URLSearchParams(String(init.body));
    expect(form.get("mode")).toBe("subscription");
    expect(form.get("line_items[0][price]")).toBe("price_pro");
    expect(form.get("client_reference_id")).toBe("biz_1");
    expect(form.get("subscription_data[metadata][businessId]")).toBe("biz_1");
    // A new customer is found by email; an existing one by id, never both.
    expect(form.get("customer_email")).toBe("owner@guesthouse.lb");
    expect(form.has("customer")).toBe(false);
  });

  it("reuses the business's Stripe customer when it has one", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ url: "u" }));
    vi.stubGlobal("fetch", fetchMock);
    await createSubscriptionCheckout({ ...checkout, customerId: "cus_1" });
    const form = new URLSearchParams(String(fetchMock.mock.calls[0]![1].body));
    expect(form.get("customer")).toBe("cus_1");
    expect(form.has("customer_email")).toBe(false);
  });

  it("answers a Stripe outage with a calm 503, and calls nothing without a key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    await expect(createBillingPortalSession("cus_1", "https://mabeet.example")).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(createBillingPortalSession("cus_1", "https://mabeet.example")).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });

    env.STRIPE_SECRET_KEY = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createBillingPortalSession("cus_1", "https://mabeet.example")).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
