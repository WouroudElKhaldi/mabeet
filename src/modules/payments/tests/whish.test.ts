import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  WHISH_MODE: "sandbox" as "simulator" | "sandbox" | "production",
  WHISH_CHANNEL: "channel-1" as string | undefined,
  WHISH_SECRET: "secret-1" as string | undefined,
  WHISH_WEBSITE_URL: "https://mabeet.example" as string | undefined,
  BETTER_AUTH_URL: "https://mabeet.example",
  VAPID_SUBJECT: "mailto:hello@mabeet.example",
}));
vi.mock("@/server/env", () => ({ env }));

const { createWhishPayment, getWhishStatus, whishAmount, whishEnabled } = await import("../server/whish");

const envelope = (data: unknown, status = true, code: string | null = null) =>
  new Response(JSON.stringify({ status, code, dialog: null, actions: null, extra: null, data }), {
    status: 200,
  });

const payment = {
  externalId: "pay_1",
  amountCents: 3000,
  currency: "USD",
  invoice: "Mabeet PRO plan, one month",
  successCallbackUrl: "https://mabeet.example/cb",
  failureCallbackUrl: "https://mabeet.example/cb?attempt=failed",
  successRedirectUrl: "https://mabeet.example/done",
  failureRedirectUrl: "https://mabeet.example/done",
};

afterEach(() => {
  vi.unstubAllGlobals();
  Object.assign(env, {
    WHISH_MODE: "sandbox",
    WHISH_CHANNEL: "channel-1",
    WHISH_SECRET: "secret-1",
    WHISH_WEBSITE_URL: "https://mabeet.example",
  });
});

describe("Whish Pay client", () => {
  it("writes amounts the way Whish wants them", () => {
    expect(whishAmount(1250, "USD")).toBe("12.50");
    expect(whishAmount(150_000_000, "LBP")).toBe("1500000");
  });

  it("sends Whish's headers and body, and returns the collectUrl", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      envelope({ collectUrl: "https://whish.money/pay/abc" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await createWhishPayment(payment)).toBe("https://whish.money/pay/abc");
    const [called, init] = fetchMock.mock.calls[0]!;
    expect(called).toBe("https://partner.api.sbx.whish.money/itel-service/api/payment/whish");
    expect(init.headers).toMatchObject({
      channel: "channel-1",
      secret: "secret-1",
      websiteUrl: "https://mabeet.example",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      amount: "30.00",
      currency: "USD",
      externalId: "pay_1",
    });
  });

  it("reads the collect status, and treats code 500 (outcome unknown) as an error, never as paid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => envelope({ collectStatus: "success", payerPhoneNumber: "96170123456" })),
    );
    expect(await getWhishStatus("pay_1", "USD")).toEqual({ status: "success", payerPhone: "96170123456" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => envelope({ collectStatus: "something new" })),
    );
    expect(await getWhishStatus("pay_1", "USD")).toEqual({ status: "unknown", payerPhone: null });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => envelope(null, false, "500")),
    );
    await expect(getWhishStatus("pay_1", "USD")).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("answers a network failure or a timeout with a calm 503", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(createWhishPayment(payment)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("talks to the simulator inside the app in simulator mode, with no keys needed", async () => {
    Object.assign(env, { WHISH_MODE: "simulator", WHISH_CHANNEL: undefined, WHISH_SECRET: undefined });
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => envelope({ collectUrl: "x" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(whishEnabled()).toBe(true);
    await createWhishPayment(payment);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://mabeet.example/api/whish-simulator/payment/whish");
  });

  it("is off, and refuses to call anything, in sandbox mode without the keys", async () => {
    env.WHISH_SECRET = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(whishEnabled()).toBe(false);
    await expect(createWhishPayment(payment)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
