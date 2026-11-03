import { describe, expect, it } from "vitest";
import { prisma, stay } from "@tests/integration/helpers";
import { requestBooking } from "../server";
import { placeWithRoom, requestFor } from "./fixtures";

// Twenty guests ask for the last room at the same moment: exactly one gets it, the others hear at once.

describe("guests racing for the same room", () => {
  it("gives the nights to exactly one of 20 requests at the same moment", async () => {
    const place = await placeWithRoom();
    const range = stay(20, 2);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => requestBooking(requestFor(place, range))),
    );
    const won = results.filter((result) => result.status === "fulfilled");
    const lost = results.filter((result) => result.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(19);
    for (const result of lost) {
      expect(result.reason).toMatchObject({
        code: "CONFLICT",
        message: "Those dates were just taken. Please pick other dates.",
      });
    }
    expect(await prisma.occupancy.count({ where: { roomId: place.room.id, active: true } })).toBe(1);
    expect(await prisma.booking.count({ where: { roomId: place.room.id } })).toBe(1);
  });

  it("takes 20 requests for different nights at the same moment", async () => {
    const place = await placeWithRoom();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) => requestBooking(requestFor(place, stay(30 + index * 2, 2)))),
    );
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(await prisma.occupancy.count({ where: { roomId: place.room.id, active: true } })).toBe(20);
  });
});
