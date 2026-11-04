import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({
  env: {
    WHISH_MODE: "simulator",
    BETTER_AUTH_URL: "https://mabeet.example",
    BETTER_AUTH_SECRET: "a-test-secret-that-is-at-least-32-characters",
  },
}));
const { saved, findByCode } = vi.hoisted(() => ({ saved: vi.fn(), findByCode: vi.fn() }));
vi.mock("../server/whish-simulator-repository", () => ({
  upsertSimulatedPayment: saved,
  findSimulatedPaymentByCode: findByCode,
}));

const { createSimulatedPayment, fromOurWhishClient, getPayPage } =
  await import("../server/whish-simulator-service");
const { simulatorSecret } = await import("../server/whish");

const body = {
  amount: "10.00",
  currency: "USD",
  externalId: "plan_1",
  successCallbackUrl: "https://mabeet.example/api/payments/whish/callback?plan=plan_1",
  failureCallbackUrl: "https://mabeet.example/api/payments/whish/callback?plan=plan_1&attempt=failed",
  successRedirectUrl: "https://mabeet.example/dashboard/b1/billing",
  failureRedirectUrl: "https://mabeet.example/dashboard/b1/billing",
};

describe("the Whish simulator", () => {
  it("answers only this server's own Whish client, never someone who copied the headers from the code", () => {
    const headers = (secret: string) =>
      new Headers({ channel: "simulator", secret, websiteUrl: "https://x" });
    expect(fromOurWhishClient(headers(simulatorSecret()))).toBe(true);
    expect(fromOurWhishClient(headers("simulator"))).toBe(false);
    expect(fromOurWhishClient(headers(""))).toBe(false);
    expect(fromOurWhishClient(new Headers())).toBe(false);
  });

  it("only calls back and redirects to this site, so nobody can make our server fetch their address", async () => {
    for (const field of ["successCallbackUrl", "failureCallbackUrl", "successRedirectUrl"] as const) {
      const answer = await createSimulatedPayment({ ...body, [field]: "http://169.254.169.254/latest" });
      expect(answer).toMatchObject({ status: false, code: "url.not_allowed" });
    }
    expect(saved).not.toHaveBeenCalled();
  });

  it("shows the payer the amount, what it is for, and the way back", async () => {
    findByCode.mockResolvedValueOnce({
      ...body,
      code: "c1",
      invoice: "Beit Tannour, 2 nights",
      status: "pending",
    });
    await expect(getPayPage("c1")).resolves.toEqual({
      amount: "10.00",
      currency: "USD",
      invoice: "Beit Tannour, 2 nights",
      status: "pending",
      cancelUrl: body.failureRedirectUrl,
    });
  });

  it("answers not found for a code it never made", async () => {
    findByCode.mockResolvedValueOnce(null);
    await expect(getPayPage("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
