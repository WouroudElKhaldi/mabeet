import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import { getPlanRevenue } from "../server";

// Mabeet's own revenue: plans paid by card or Whish. Only paid payments count, and each month is its own. Other tests add plan payments too, so the months used here are far in the future.

const NOW = new Date("2090-06-15T12:00:00Z");

async function planPayment(
  businessId: string,
  amountCents: number,
  method: "STRIPE" | "WHISH",
  paidAt: Date,
  status: "PAID" | "FAILED" = "PAID",
) {
  await prisma.planPayment.create({
    data: {
      businessId,
      plan: "PRO",
      amountCents,
      currency: "USD",
      method,
      status,
      providerRef: randomUUID(),
      paidAt,
    },
  });
}

describe("plan revenue", () => {
  it("adds up paid plans by month and by card or Whish", async () => {
    const { business } = await createPlace();
    const admin = await createPlatformAdmin();
    const before = await getPlanRevenue(admin, NOW);
    await planPayment(business.id, 2_900, "STRIPE", new Date("2090-06-02T09:00:00Z"));
    await planPayment(business.id, 2_900, "WHISH", new Date("2090-06-10T09:00:00Z"));
    await planPayment(business.id, 2_900, "WHISH", new Date("2090-05-10T09:00:00Z"));
    await planPayment(business.id, 9_900, "STRIPE", new Date("2090-06-11T09:00:00Z"), "FAILED");

    const revenue = await getPlanRevenue(admin, NOW);
    expect(revenue.thisMonth).toEqual([{ currency: "USD", cents: 5_800, payments: 2 }]);
    expect(revenue.byWhish).toEqual([{ currency: "USD", cents: 5_800, payments: 2 }]);
    expect(revenue.byCard).toEqual([{ currency: "USD", cents: 2_900, payments: 1 }]);
    const usd = (rows: typeof revenue.allTime) => rows.find((row) => row.currency === "USD")?.cents ?? 0;
    expect(usd(revenue.allTime) - usd(before.allTime)).toBe(8_700);
  });
});
