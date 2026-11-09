import { describe, expect, it } from "vitest";
import { createPlace, createPlatformAdmin, memberWith } from "@tests/integration/helpers";
import { listPlatformPeople } from "../server";

// The admin's list of people: the newest first, with how many places each works in.

describe("the people on the platform", () => {
  it("lists the newest accounts with the places they work in", async () => {
    const place = await createPlace();
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    const admin = await createPlatformAdmin();
    const { total, people } = await listPlatformPeople(admin);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(people.find((person) => person.id === admin.userId)?.platformRole).toBe("SUPER_ADMIN");
    expect(people.find((person) => person.id === staff.userId)).toMatchObject({
      placeCount: 1,
      tripCount: 0,
    });
  });
});
