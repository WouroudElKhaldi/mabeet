import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import { getPlanRevenue } from "../server";

// Mabeet's own revenue: plans paid by card or Whish. Only paid payments count, and each month is its own. The months used here are far in the future, away from
// the plan payments other tests add.

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
    // Tests never empty the database, so each figure is compared with what was there before.
    const added = (key: "allTime" | "thisMonth" | "byCard" | "byWhish") => {
      const usd = (rows: Array<{ currency: string; cents: number }>) =>
        rows.find((row) => row.currency === "USD")?.cents ?? 0;
      return usd(revenue[key]) - usd(before[key]);
    };
    expect(added("thisMonth")).toBe(5_800);
    expect(added("byWhish")).toBe(5_800);
    expect(added("byCard")).toBe(2_900);
    expect(added("allTime")).toBe(8_700);
  });
});
