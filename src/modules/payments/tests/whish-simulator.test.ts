import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({
  env: { WHISH_MODE: "simulator", BETTER_AUTH_URL: "https://mabeet.example" },
}));
const saved = vi.hoisted(() => vi.fn());
vi.mock("../server/whish-simulator-repository", () => ({ upsertSimulatedPayment: saved }));

const { createSimulatedPayment } = await import("../server/whish-simulator-service");

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
  it("only calls back and redirects to this site, so nobody can make our server fetch their address", async () => {
    for (const field of ["successCallbackUrl", "failureCallbackUrl", "successRedirectUrl"] as const) {
      const answer = await createSimulatedPayment({ ...body, [field]: "http://169.254.169.254/latest" });
      expect(answer).toMatchObject({ status: false, code: "url.not_allowed" });
    }
    expect(saved).not.toHaveBeenCalled();
  });
});
