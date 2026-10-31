import { describe, expect, it } from "vitest";
import { moneyNumber, prisma } from "@/server/db/client";
import { secureToken } from "@/utils/tokens";

describe("money columns", () => {
  it("reads an LBP price past the 32-bit limit back exactly, as a plain number", async () => {
    const business = await prisma.business.create({
      data: { name: "Beit Batroun", slug: `beit-batroun-${secureToken(4)}`, currency: "LBP" },
    });
    // 2.25 billion minor units, past the old INTEGER limit of about 2.1 billion.
    const room = await prisma.room.create({
      data: {
        businessId: business.id,
        name: "Sea room",
        baseRateCents: 2_250_000_000,
        exportToken: secureToken(),
      },
    });
    const stored = await prisma.room.findUniqueOrThrow({ where: { id: room.id } });
    expect(typeof stored.baseRateCents).toBe("number");
    expect(stored.baseRateCents).toBe(2_250_000_000);
  });

  it("refuses an amount too large to handle exactly, instead of rounding it", () => {
    expect(moneyNumber(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => moneyNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(/too large/);
  });
});
