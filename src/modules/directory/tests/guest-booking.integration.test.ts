import { beforeEach, describe, expect, it } from "vitest";
import * as bookingsRoute from "@/app/api/public/places/[slug]/bookings/route";
import { addRoom, createPlace, prisma, stay } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { toIsoDate } from "@/utils/dates";

// A guest asks for a stay from the book page: the route holds the room at once, takes who the guest is from their
// session, and answers only with what they need to go on.

async function placeWithRoom(room: Parameters<typeof addRoom>[1] = {}) {
  const place = await createPlace();
  return { ...place, room: await addRoom(place.business.id, { capacity: 3, ...room }) };
}

type Place = Awaited<ReturnType<typeof placeWithRoom>>;

function bodyFor(place: Place, daysAhead = 10, nights = 2, overrides: Record<string, unknown> = {}) {
  const range = stay(daysAhead, nights);
  return {
    roomId: place.room.id,
    checkIn: toIsoDate(range.checkIn),
    checkOut: toIsoDate(range.checkOut),
    guestCount: 2,
    guestName: "Maya Haddad",
    guestPhone: "+96171123456",
    ...overrides,
  };
}

describe("POST /api/public/places/{slug}/bookings", () => {
  beforeEach(resetMemoryRateLimits);

  it("holds the room for the signed-in guest and gives them the link to their booking", async () => {
    const place = await placeWithRoom();
    const guest = await signUp("Maya");
    const response = await call(bookingsRoute.POST, {
      as: guest,
      params: { slug: place.business.slug },
      body: bodyFor(place, 10, 2, { guestEmail: "maya@example.test", guestNote: "Arriving late" }),
    });
    expect(response.status).toBe(201);
    const { publicToken, reference, status } = response.body as {
      publicToken: string;
      reference: string;
      status: string;
    };
    expect(publicToken.length).toBeGreaterThanOrEqual(20);
    expect(reference).toMatch(/^[A-Z0-9-]+$/);
    expect(status).toBe("HELD");
    // Nothing else about the booking is handed back.
    expect(Object.keys(response.body as object).sort()).toEqual(["publicToken", "reference", "status"]);

    const saved = await prisma.booking.findUniqueOrThrow({ where: { publicToken } });
    expect(saved).toMatchObject({
      guestUserId: guest.userId,
      roomId: place.room.id,
      guestCount: 2,
      guestName: "Maya Haddad",
      guestPhone: "+96171123456",
      guestEmail: "maya@example.test",
      guestNote: "Arriving late",
    });
    expect(await prisma.occupancy.count({ where: { bookingId: saved.id, active: true } })).toBe(1);
  });

  it("takes who the guest is from their session, never from the body", async () => {
    const place = await placeWithRoom();
    const guest = await signUp("Maya");
    const other = await signUp("Someone else");
    const response = await call(bookingsRoute.POST, {
      as: guest,
      params: { slug: place.business.slug },
      body: bodyFor(place, 10, 2, { guestUserId: other.userId }),
    });
    expect(response.status).toBe(201);
    const saved = await prisma.booking.findUniqueOrThrow({
      where: { publicToken: (response.body as { publicToken: string }).publicToken },
    });
    expect(saved.guestUserId).toBe(guest.userId);
  });

  it("asks a signed-out guest to sign in, and holds nothing", async () => {
    const place = await placeWithRoom();
    const response = await call(bookingsRoute.POST, {
      params: { slug: place.business.slug },
      body: bodyFor(place),
    });
    expect(response.status).toBe(401);
    expect(await prisma.booking.count({ where: { roomId: place.room.id } })).toBe(0);
  });

  it("refuses what is missing or wrong with 400, and holds nothing", async () => {
    const place = await placeWithRoom();
    const guest = await signUp("Maya");
    const params = { slug: place.business.slug };
    const range = stay(10, 2);
    const checkIn = toIsoDate(range.checkIn);
    const bad: Record<string, unknown>[] = [
      { guestName: "M" },
      { guestName: undefined },
      { guestPhone: "71 123 456" },
      { guestPhone: "+961" },
      { guestEmail: "not an email" },
      { guestCount: 0 },
      { guestCount: 31 },
      { guestCount: 1.5 },
      { checkOut: checkIn },
      { checkOut: "2020-01-01" },
      { checkIn: "soon" },
      { roomId: undefined },
    ];
    for (const overrides of bad) {
      // Every request counts toward a guest's limit, bad ones too; this test is about the checks, not the limit.
      resetMemoryRateLimits();
      const response = await call(bookingsRoute.POST, {
        as: guest,
        params,
        body: bodyFor(place, 10, 2, overrides),
      });
      expect(response.status, JSON.stringify(overrides)).toBe(400);
    }
    expect(await prisma.booking.count({ where: { roomId: place.room.id } })).toBe(0);
  });

  it("refuses a stay the room cannot take: too many guests, too short, in the past, too long", async () => {
    const place = await placeWithRoom({ capacity: 2, minNights: 3 });
    const guest = await signUp("Maya");
    const params = { slug: place.business.slug };
    for (const body of [
      bodyFor(place, 10, 3, { guestCount: 3 }),
      bodyFor(place, 10, 2),
      bodyFor(place, -5, 3),
      bodyFor(place, 10, 61),
    ]) {
      expect((await call(bookingsRoute.POST, { as: guest, params, body })).status).toBe(400);
    }
  });

  it("tells a second guest on the same nights, at once, that they are taken", async () => {
    const place = await placeWithRoom();
    const first = await signUp("First");
    const second = await signUp("Second");
    const params = { slug: place.business.slug };
    expect((await call(bookingsRoute.POST, { as: first, params, body: bodyFor(place) })).status).toBe(201);
    const response = await call(bookingsRoute.POST, { as: second, params, body: bodyFor(place) });
    expect(response.status).toBe(409);
    expect(await prisma.booking.count({ where: { roomId: place.room.id } })).toBe(1);
  });

  it("answers 404 for an unknown place, another place's room and a place that is gone", async () => {
    const place = await placeWithRoom();
    const other = await placeWithRoom();
    const guest = await signUp("Maya");
    expect(
      (await call(bookingsRoute.POST, { as: guest, params: { slug: "no-such-place" }, body: bodyFor(place) }))
        .status,
    ).toBe(404);
    expect(
      (
        await call(bookingsRoute.POST, {
          as: guest,
          params: { slug: place.business.slug },
          body: bodyFor(other),
        })
      ).status,
    ).toBe(404);
    await prisma.business.update({ where: { id: place.business.id }, data: { status: "SUSPENDED" } });
    expect(
      (
        await call(bookingsRoute.POST, {
          as: guest,
          params: { slug: place.business.slug },
          body: bodyFor(place),
        })
      ).status,
    ).toBe(404);
  });

  it("slows a guest who asks too often", async () => {
    const place = await placeWithRoom();
    const guest = await signUp("Maya");
    let last = 0;
    for (let index = 0; index < 11; index += 1) {
      last = (
        await call(bookingsRoute.POST, {
          as: guest,
          params: { slug: place.business.slug },
          body: bodyFor(place, 10 + index * 3, 2),
        })
      ).status;
    }
    expect(last).toBe(429);
  });
});
