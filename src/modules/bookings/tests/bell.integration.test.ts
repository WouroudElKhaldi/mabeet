import { describe, expect, it } from "vitest";
import {
  countBusinessUnread,
  countPlatformUnread,
  getBusinessNotifications,
  getPlatformNotifications,
  markSeen,
} from "@/modules/notifications/server";
import { createPlatformAdmin, memberWith, stay } from "@tests/integration/helpers";
import { confirmBooking, requestBooking } from "../server";
import { placeWithRoom, requestFor } from "./fixtures";

// The bell: the booking engine's events reach the people who should hear them, with the guest and the reference, and
// what is new is counted until the person opens it. Their own actions are never "new" to them.

describe("the notification bell", () => {
  it("shows a guest's request with its guest and reference, and counts it until it is opened", async () => {
    const place = await placeWithRoom("OFFLINE");
    const booking = await requestBooking(requestFor(place, stay(10, 2)));

    const { items } = await getBusinessNotifications(place.ctx);
    expect(items[0]).toMatchObject({
      action: "booking.requested",
      booking: { guest: "Maya Haddad", reference: booking.reference },
      business: { id: place.business.id },
    });
    expect(await countBusinessUnread(place.ctx)).toBe(1);

    await markSeen(place.owner.id);
    expect(await countBusinessUnread(place.ctx)).toBe(0);
    await confirmBooking(place.ctx, { bookingId: booking.id });
    // The owner confirmed it themselves: it is in the list, but not new to them.
    expect((await getBusinessNotifications(place.ctx)).items[0]?.action).toBe("booking.confirmed");
    expect(await countBusinessUnread(place.ctx)).toBe(0);
  });

  it("keeps booking news from staff who cannot read bookings, and money news from everyone but owners", async () => {
    const place = await placeWithRoom("OFFLINE");
    await requestBooking(requestFor(place, stay(10, 2)));
    const teamOnly = await memberWith(place.business.id, ["team.manage"]);
    const frontDesk = await memberWith(place.business.id, ["bookings.read"]);
    expect((await getBusinessNotifications(teamOnly)).items).toEqual([]);
    expect(await countBusinessUnread(teamOnly)).toBe(0);
    expect((await getBusinessNotifications(frontDesk)).items.map((item) => item.action)).toEqual([
      "booking.requested",
    ]);
  });

  it("gives platform admins the requests of every business", async () => {
    const place = await placeWithRoom("OFFLINE");
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    const admin = await createPlatformAdmin();
    const { items } = await getPlatformNotifications(admin);
    expect(items.find((item) => item.booking?.reference === booking.reference)?.business?.name).toBe(
      place.business.name,
    );
    expect(await countPlatformUnread(admin)).toBeGreaterThan(0);
  });
});
