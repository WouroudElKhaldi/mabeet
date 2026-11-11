import { beforeEach, describe, expect, it } from "vitest";
import * as availabilityRoute from "@/app/api/public/places/[slug]/rooms/[roomId]/availability/route";
import { addRoom, createPlace, prisma, stay } from "@tests/integration/helpers";
import { call } from "@tests/integration/http";
import { addBlock } from "@/modules/bookings/server";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { addDays, toIsoDate } from "@/utils/dates";
import { getPlace, getRoomAvailability } from "../server";

// A place's page and its calendar on the real database: what a visitor may see, nothing more, and the nights that
// are taken shown as dates only.

const photo = (businessId: string, data: { roomId?: string; position: number }) =>
  prisma.photo.create({
    data: { businessId, url: `https://example.test/${crypto.randomUUID()}.jpg`, alt: "View", ...data },
  });

describe("a place's page", () => {
  it("shows the place, its rooms with their photos in order, and the place's own photos", async () => {
    const { business } = await createPlace("Beit Cedar");
    await prisma.business.update({
      where: { id: business.id },
      data: {
        description: "Under the cedars",
        area: "Bsharri",
        houseRules: "No smoking",
        currency: "USD",
        latitude: 34.2512,
        longitude: 36.0107,
      },
    });
    const room = await addRoom(business.id, { capacity: 3, baseRateCents: 9_500, minNights: 2 });
    await prisma.room.update({ where: { id: room.id }, data: { amenities: ["wifi", "view"] } });
    const second = await photo(business.id, { roomId: room.id, position: 2 });
    const first = await photo(business.id, { roomId: room.id, position: 1 });
    const own = await photo(business.id, { position: 0 });

    const place = await getPlace(business.slug);
    expect(place).toMatchObject({
      slug: business.slug,
      name: "Beit Cedar",
      description: "Under the cedars",
      area: "Bsharri",
      houseRules: "No smoking",
      currency: "USD",
      bookingUnit: "ROOMS",
      checkInTime: "14:00",
      // What the map is centred on; a place whose host gave none keeps both null and shows no map.
      latitude: 34.2512,
      longitude: 36.0107,
    });
    expect(place?.photos.map((picture) => picture.id)).toEqual([own.id]);
    expect(place?.units.map((unit) => unit.id)).toEqual([room.id]);
    expect(place?.rooms.map((unit) => unit.id)).toEqual([room.id]);
    expect(place?.units[0]).toMatchObject({
      capacity: 3,
      baseRateCents: 9_500,
      minNights: 2,
      amenities: ["wifi", "view"],
    });
    expect(place?.units[0]?.photos.map((picture) => picture.id)).toEqual([first.id, second.id]);
  });

  it("never gives a visitor what only the owner may see", async () => {
    const { business } = await createPlace();
    await prisma.business.update({
      where: { id: business.id },
      data: { paymentInstructions: "Whish 03 123 456", commissionRateBps: 1200 },
    });
    const room = await addRoom(business.id);
    const place = await getPlace(business.slug);
    const text = JSON.stringify(place);
    for (const secret of [
      "paymentInstructions",
      "Whish 03 123 456",
      "commissionRate",
      "stripe",
      "plan",
      "exportToken",
    ]) {
      expect(text, secret).not.toContain(secret);
    }
    expect(text).not.toContain(room.exportToken);
    expect(place).not.toHaveProperty("id");
  });

  it("keeps an unlisted place's page (its link is shared on Instagram), but not a paused or deleted one", async () => {
    const unlisted = await createPlace();
    await addRoom(unlisted.business.id);
    expect(await prisma.business.findUniqueOrThrow({ where: { id: unlisted.business.id } })).toMatchObject({
      listedPublicly: false,
    });
    expect(await getPlace(unlisted.business.slug)).not.toBeNull();

    const paused = await createPlace();
    await prisma.business.update({ where: { id: paused.business.id }, data: { status: "SUSPENDED" } });
    expect(await getPlace(paused.business.slug)).toBeNull();

    const deleted = await createPlace();
    await prisma.business.update({ where: { id: deleted.business.id }, data: { isDeleted: true } });
    expect(await getPlace(deleted.business.slug)).toBeNull();

    expect(await getPlace("no-such-place")).toBeNull();
  });

  it("leaves out rooms the host switched off or deleted", async () => {
    const { business } = await createPlace();
    const live = await addRoom(business.id);
    const off = await addRoom(business.id);
    await prisma.room.update({ where: { id: off.id }, data: { active: false } });
    const gone = await addRoom(business.id);
    await prisma.room.update({ where: { id: gone.id }, data: { isDeleted: true } });
    expect((await getPlace(business.slug))?.units.map((unit) => unit.id)).toEqual([live.id]);
  });

  it("books a place that rents whole through its one whole-place unit, and lists its rooms to show", async () => {
    const { business } = await createPlace();
    await prisma.business.update({ where: { id: business.id }, data: { bookingUnit: "WHOLE_PLACE" } });
    const room = await addRoom(business.id);
    const whole = await addRoom(business.id, { kind: "WHOLE_PLACE", capacity: 8 });
    const place = await getPlace(business.slug);
    expect(place?.bookingUnit).toBe("WHOLE_PLACE");
    expect(place?.units.map((unit) => unit.id)).toEqual([whole.id]);
    expect(place?.rooms.map((unit) => unit.id)).toEqual([room.id]);
  });

  it("shows the rooms' photos when the place has none of its own", async () => {
    const { business } = await createPlace();
    const room = await addRoom(business.id);
    const roomPhoto = await photo(business.id, { roomId: room.id, position: 0 });
    expect((await getPlace(business.slug))?.photos.map((picture) => picture.id)).toEqual([roomPhoto.id]);
  });
});

describe("a room's calendar", () => {
  beforeEach(resetMemoryRateLimits);

  async function placeWithRoom() {
    const place = await createPlace();
    return { ...place, room: await addRoom(place.business.id) };
  }

  it("lists the taken nights as dates only, and frees the check-out night", async () => {
    const place = await placeWithRoom();
    const closed = stay(5, 2);
    await addBlock(place.ctx, { roomId: place.room.id, range: closed, note: "Private note" });
    const availability = await getRoomAvailability(place.business.slug, place.room.id, stay(0, 30));
    expect(availability).toEqual({
      roomId: place.room.id,
      takenNights: [toIsoDate(closed.checkIn), toIsoDate(addDays(closed.checkIn, 1))],
    });
    expect(JSON.stringify(availability)).not.toContain("Private note");
  });

  it("answers not found for an unknown place, another place's room, a switched-off room and a room the place does not book by", async () => {
    const place = await placeWithRoom();
    const other = await placeWithRoom();
    const range = stay(0, 30);
    await expect(getRoomAvailability("no-such-place", place.room.id, range)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(getRoomAvailability(place.business.slug, other.room.id, range)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const whole = await addRoom(place.business.id, { kind: "WHOLE_PLACE" });
    await expect(getRoomAvailability(place.business.slug, whole.id, range)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await prisma.room.update({ where: { id: place.room.id }, data: { active: false } });
    await expect(getRoomAvailability(place.business.slug, place.room.id, range)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("answers a guest who is not signed in, with the year ahead by default", async () => {
    const place = await placeWithRoom();
    const closed = stay(300, 1);
    await addBlock(place.ctx, { roomId: place.room.id, range: closed, note: null });
    const response = await call(availabilityRoute.GET, {
      params: { slug: place.business.slug, roomId: place.room.id },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ roomId: place.room.id, takenNights: [toIsoDate(closed.checkIn)] });
  });

  it("refuses a window that is backwards, not dates, or longer than the engine reads, with 400", async () => {
    const place = await placeWithRoom();
    const params = { slug: place.business.slug, roomId: place.room.id };
    const badWindows: Record<string, string>[] = [
      { from: "2026-12-10", to: "2026-12-09" },
      { from: "soon" },
      { from: "2026-01-01", to: "2028-01-01" },
    ];
    for (const query of badWindows) {
      expect((await call(availabilityRoute.GET, { params, query })).status).toBe(400);
    }
  });

  it("slows a caller who asks too often", async () => {
    const place = await placeWithRoom();
    const options = { params: { slug: place.business.slug, roomId: place.room.id } };
    let last = 200;
    for (let index = 0; index < 125; index += 1) last = (await call(availabilityRoute.GET, options)).status;
    expect(last).toBe(429);
  });
});
