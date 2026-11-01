import { describe, expect, it, vi } from "vitest";
import { prisma, stay } from "@tests/integration/helpers";
import { requestBooking } from "../server";
import { placeWithRoom, requestFor } from "./fixtures";

// All or nothing: the booking, its nights and its log line are one transaction. When the last step fails, the
// earlier ones are undone, so no half-made booking holds the room.

const failNextLog = vi.hoisted(() => ({ on: false }));
vi.mock(import("@/modules/audit/server"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    recordPersonAndBusiness: vi.fn(async (...args: Parameters<typeof actual.recordPersonAndBusiness>) => {
      if (failNextLog.on) {
        failNextLog.on = false;
        throw new Error("the log could not be written");
      }
      return actual.recordPersonAndBusiness(...args);
    }),
  };
});

describe("a booking whose last step fails", () => {
  it("leaves no booking and no taken nights, and the same request then succeeds", async () => {
    const place = await placeWithRoom();
    const range = stay(10, 2);
    failNextLog.on = true;
    await expect(requestBooking(requestFor(place, range))).rejects.toThrow("the log could not be written");
    expect(await prisma.booking.count({ where: { roomId: place.room.id } })).toBe(0);
    expect(await prisma.occupancy.count({ where: { roomId: place.room.id } })).toBe(0);

    await expect(requestBooking(requestFor(place, range))).resolves.toMatchObject({ status: "HELD" });
  });
});
