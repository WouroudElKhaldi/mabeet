import { describe, expect, it } from "vitest";
import { createUser, prisma } from "@tests/integration/helpers";
import { requestSessionBooking } from "../server";
import { placeWithSession, seatsFor } from "./fixtures";

// The database never seats more guests than a session has, whatever the code does: the session_seats_guard trigger
// refuses a booking that would go over, and session_capacity_guard refuses shrinking a session below what is sold.

describe("the last seats", () => {
  it("go to exactly as many guests as fit when 20 race for 5", async () => {
    const place = await placeWithSession("OFFLINE", { capacity: 5 });
    const guests = await Promise.all(Array.from({ length: 20 }, (_, i) => createUser(`Racer ${i}`)));
    const results = await Promise.allSettled(
      guests.map((guest) => requestSessionBooking(seatsFor(place, 1, { guestUserId: guest.id }))),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    const refused = results.filter((result) => result.status === "rejected");
    expect(refused).toHaveLength(15);
    for (const result of refused) {
      expect(result.reason).toMatchObject({ code: "CONFLICT", message: expect.stringContaining("seats") });
    }
    const seated = await prisma.sessionBooking.aggregate({
      where: { sessionId: place.session.id, status: "HELD" },
      _sum: { seats: true },
    });
    expect(seated._sum.seats).toBe(5);
  });

  it("are refused to a row written by hand, past the code", async () => {
    const place = await placeWithSession("OFFLINE", { capacity: 2 });
    await requestSessionBooking(seatsFor(place, 2));
    const byHand = (status: "HELD" | "CANCELLED") =>
      prisma.sessionBooking.create({
        data: {
          businessId: place.business.id,
          offeringId: place.offering.id,
          sessionId: place.session.id,
          guestUserId: place.guest.id,
          guestName: "Written by hand",
          guestPhone: "+96171000000",
          seats: 1,
          totalCents: 2_500,
          currency: "USD",
          bookingMode: "OFFLINE",
          status,
          reference: `HAND-${crypto.randomUUID()}`,
          publicToken: crypto.randomUUID(),
        },
      });
    await expect(byHand("HELD")).rejects.toThrow();
    // A row that holds no seats is not counted.
    await expect(byHand("CANCELLED")).resolves.toMatchObject({ status: "CANCELLED" });
  });

  it("can't be shrunk below what is already sold", async () => {
    const place = await placeWithSession("OFFLINE", { capacity: 6 });
    await requestSessionBooking(seatsFor(place, 4));
    await expect(
      prisma.offeringSession.update({ where: { id: place.session.id }, data: { capacity: 3 } }),
    ).rejects.toThrow();
    await expect(
      prisma.offeringSession.update({ where: { id: place.session.id }, data: { capacity: 4 } }),
    ).resolves.toMatchObject({ capacity: 4 });
  });
});
