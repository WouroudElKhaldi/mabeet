import { describe, expect, it } from "vitest";
import { prisma, stay } from "@tests/integration/helpers";
import { isOverlapError } from "@/server/db/client";
import type { DateRange } from "@/utils/dates";
import { placeWithRoom } from "./fixtures";

// The database itself refuses two live stays on one room night (occupancy_no_overlap), whatever the code does.

async function nightsOn(roomId: string, businessId: string, range: DateRange, extra: object = {}) {
  return prisma.occupancy.create({ data: { businessId, roomId, kind: "MANUAL", ...range, ...extra } });
}

describe("the database's own guard against double bookings", () => {
  it("refuses two live overlapping stays on one room", async () => {
    const { business, room } = await placeWithRoom();
    await nightsOn(room.id, business.id, stay(10, 3));
    const error = await nightsOn(room.id, business.id, stay(11, 1)).catch((caught: unknown) => caught);
    expect(isOverlapError(error)).toBe(true);
  });

  it("lets stays touch: the check-out night is free", async () => {
    const { business, room } = await placeWithRoom();
    await nightsOn(room.id, business.id, stay(10, 2));
    await expect(nightsOn(room.id, business.id, stay(12, 2))).resolves.toBeDefined();
  });

  it("ignores inactive rows, and lets platform stays overlap each other and ours", async () => {
    const { business, room } = await placeWithRoom();
    await nightsOn(room.id, business.id, stay(10, 3), { active: false });
    await expect(nightsOn(room.id, business.id, stay(10, 3))).resolves.toBeDefined();
    await expect(nightsOn(room.id, business.id, stay(10, 3), { kind: "IMPORTED" })).resolves.toBeDefined();
    await expect(nightsOn(room.id, business.id, stay(11, 1), { kind: "IMPORTED" })).resolves.toBeDefined();
  });

  it("refuses a check-out that is not after check-in", async () => {
    const { business, room } = await placeWithRoom();
    const range = stay(10, 1);
    await expect(
      nightsOn(room.id, business.id, { checkIn: range.checkOut, checkOut: range.checkIn }),
    ).rejects.toThrow();
  });
});
