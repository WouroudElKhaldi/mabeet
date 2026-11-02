import { beforeEach, describe, expect, it } from "vitest";
import * as quoteRoute from "@/app/api/public/places/[slug]/rooms/[roomId]/quote/route";
import { addRoom, createPlace, prisma, stay } from "@tests/integration/helpers";
import { call } from "@tests/integration/http";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { addDays, toIsoDate } from "@/utils/dates";
import { quoteRoom } from "../server";

// A guest's price check on the real database: special prices count, a place that books whole prices only its whole
// unit, and a stay that cannot be booked says why instead of failing.

async function placeWithRoom(room: Parameters<typeof addRoom>[1] = {}) {
  const place = await createPlace();
  return { ...place, room: await addRoom(place.business.id, { baseRateCents: 9_000, ...room }) };
}

describe("the price of a stay", () => {
  beforeEach(resetMemoryRateLimits);

  it("adds each night's price, with a special price on the nights that have one", async () => {
    const place = await placeWithRoom();
    const range = stay(10, 3);
    await prisma.rateOverride.create({
      data: {
        businessId: place.business.id,
        roomId: place.room.id,
        date: addDays(range.checkIn, 1),
        rateCents: 15_000,
      },
    });
    const quote = await quoteRoom(place.business.slug, place.room.id, { range, guests: 2 });
    expect(quote).toMatchObject({
      roomId: place.room.id,
      currency: "USD",
      nightCount: 3,
      totalCents: 33_000,
      issue: null,
    });
    expect(quote.nights.map((night) => night.rateCents)).toEqual([9_000, 15_000, 9_000]);
    expect(quote.nights[0]?.date).toBe(toIsoDate(range.checkIn));
  });

  it("still gives the price of a stay that cannot be booked, with the reason", async () => {
    const place = await placeWithRoom({ capacity: 2, minNights: 2 });
    const tooShort = await quoteRoom(place.business.slug, place.room.id, {
      range: stay(10, 1),
      guests: null,
    });
    expect(tooShort).toMatchObject({ issue: "MIN_NIGHTS", totalCents: 9_000 });
    const tooMany = await quoteRoom(place.business.slug, place.room.id, { range: stay(10, 3), guests: 5 });
    expect(tooMany).toMatchObject({ issue: "CAPACITY", totalCents: 27_000 });
  });

  it("does not price a stay that is too long to be booked", async () => {
    const place = await placeWithRoom();
    const quote = await quoteRoom(place.business.slug, place.room.id, { range: stay(5, 400), guests: null });
    expect(quote).toMatchObject({ issue: "TOO_LONG", nights: [], totalCents: 0, nightCount: 400 });
  });

  it("answers not found for an unknown place, another place's room, and a room the place does not book by", async () => {
    const place = await placeWithRoom();
    const other = await placeWithRoom();
    const range = stay(10, 2);
    await expect(quoteRoom("no-such-place", place.room.id, { range, guests: null })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      quoteRoom(place.business.slug, other.room.id, { range, guests: null }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // The place books room by room, so its whole-place unit has no price of its own.
    const whole = await addRoom(place.business.id, { kind: "WHOLE_PLACE" });
    await expect(quoteRoom(place.business.slug, whole.id, { range, guests: null })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("does not quote a place that is closed or deleted", async () => {
    const place = await placeWithRoom();
    await prisma.business.update({ where: { id: place.business.id }, data: { isDeleted: true } });
    await expect(
      quoteRoom(place.business.slug, place.room.id, { range: stay(10, 2), guests: null }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("GET /api/public/places/{slug}/rooms/{roomId}/quote", () => {
  beforeEach(resetMemoryRateLimits);

  it("answers a guest who is not signed in", async () => {
    const place = await placeWithRoom();
    const range = stay(10, 2);
    const response = await call(quoteRoute.GET, {
      params: { slug: place.business.slug, roomId: place.room.id },
      query: { checkIn: toIsoDate(range.checkIn), checkOut: toIsoDate(range.checkOut), guests: "2" },
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ totalCents: 18_000, nightCount: 2, issue: null });
  });

  it("refuses dates that are missing, back to front, or not dates, with 400", async () => {
    const place = await placeWithRoom();
    const params = { slug: place.business.slug, roomId: place.room.id };
    const badQueries: Record<string, string>[] = [
      {},
      { checkIn: "2026-12-10" },
      { checkIn: "2026-12-10", checkOut: "2026-12-09" },
      { checkIn: "2026-12-10", checkOut: "2026-02-31" },
      { checkIn: "2026-12-10", checkOut: "2026-12-12", guests: "0" },
      { checkIn: "2026-12-10", checkOut: "2026-12-12", guests: "many" },
    ];
    for (const query of badQueries) {
      expect((await call(quoteRoute.GET, { params, query })).status).toBe(400);
    }
  });

  it("answers 404 for an unknown place", async () => {
    const response = await call(quoteRoute.GET, {
      params: { slug: "no-such-place", roomId: "x" },
      query: { checkIn: "2026-12-10", checkOut: "2026-12-12" },
    });
    expect(response.status).toBe(404);
  });

  it("slows a caller who asks too often", async () => {
    const place = await placeWithRoom();
    const options = {
      params: { slug: place.business.slug, roomId: place.room.id },
      query: { checkIn: "2030-12-10", checkOut: "2030-12-12" },
    };
    let last = 200;
    for (let index = 0; index < 125; index += 1) last = (await call(quoteRoute.GET, options)).status;
    expect(last).toBe(429);
  });
});
