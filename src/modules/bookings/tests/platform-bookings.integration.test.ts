import { describe, expect, it } from "vitest";
import { createPlatformAdmin, prisma, stay } from "@tests/integration/helpers";
import { countPlatformBookings, requestBooking } from "../server";
import { placeWithRoom, requestFor } from "./fixtures";

// The admin overview counts booking requests on the whole platform: all of them, and those of the last 30 days.

describe("bookings on the platform", () => {
  it("counts a new request in both, and an old one only in all time", async () => {
    const admin = await createPlatformAdmin();
    const before = await countPlatformBookings(admin);
    const place = await placeWithRoom("OFFLINE");
    await requestBooking(requestFor(place, stay(10, 2)));
    const old = await requestBooking(requestFor(place, stay(20, 2)));
    await prisma.booking.update({
      where: { id: old.id },
      data: { createdAt: new Date("2020-01-01T00:00:00Z") },
    });
    const after = await countPlatformBookings(admin);
    expect(after.total - before.total).toBe(2);
    expect(after.recent - before.recent).toBe(1);
  });
});
