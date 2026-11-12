import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addRoom, createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import { getSyncHealth } from "../server";

// The admin's sync health lists the links that need a look, with their place and room, and leaves the healthy ones
// and removed ones out.

describe("calendar sync health", () => {
  it("lists a failing link with its place, not a healthy or removed one", async () => {
    const place = await createPlace();
    const room = await addRoom(place.business.id);
    const link = (data: { lastError?: string; lastSyncedAt?: Date; isDeleted?: boolean }) =>
      prisma.calendarFeed.create({
        data: {
          businessId: place.business.id,
          roomId: room.id,
          url: `https://www.airbnb.com/calendar/ical/${randomUUID()}.ics`,
          source: "AIRBNB",
          ...data,
        },
      });
    const failing = await link({ lastError: "Airbnb did not answer", lastSyncedAt: new Date() });
    const healthy = await link({ lastSyncedAt: new Date() });
    const removed = await link({ lastError: "Gone", isDeleted: true });

    const admin = await createPlatformAdmin();
    // Searched by a name only this place has, so links other tests left behind never crowd it off the first page.
    const name = `Beit ${randomUUID()}`;
    await prisma.business.update({ where: { id: place.business.id }, data: { name } });
    const { needsLook, found } = await getSyncHealth(admin, { q: name });
    expect(found).toBe(needsLook.length);
    const ids = needsLook.map((feed) => feed.id);
    expect(needsLook.find((feed) => feed.id === failing.id)).toMatchObject({
      business: { name },
      room: { name: room.name },
    });
    expect(ids).not.toContain(healthy.id);
    expect(ids).not.toContain(removed.id);

    const other = await getSyncHealth(admin, { q: room.name, source: "BOOKING" });
    expect(other.needsLook.map((feed) => feed.id)).not.toContain(failing.id);
  });
});
