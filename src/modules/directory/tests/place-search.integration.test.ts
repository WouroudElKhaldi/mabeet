import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addRoom, createPlace, prisma, stay } from "@tests/integration/helpers";
import { addBlock } from "@/modules/bookings/server";
import { addDays } from "@/utils/dates";
import type { PlaceSearch } from "../search-query";
import { searchPlaces } from "../server";

// Search on the real database: only listed places, only units that fit, never a near miss. Other tests leave places
// behind, so each test finds its own by a word only its places have.

/** A listed place whose name holds `word`, so a search for the word finds only this test's places. */
async function listedPlace(word: string, data: { area?: string; region?: string } = {}) {
  const place = await createPlace(`Beit ${word} ${randomUUID().slice(0, 6)}`);
  await prisma.business.update({ where: { id: place.business.id }, data: { listedPublicly: true, ...data } });
  return place;
}

const search = (word: string, query: Partial<PlaceSearch> = {}) =>
  searchPlaces({ text: word, guests: 1, limit: 20, ...query });

const slugs = (cards: { slug: string }[]) => cards.map((card) => card.slug);

describe("searching places", () => {
  it("finds only listed, live places", async () => {
    const word = randomUUID().slice(0, 8);
    const listed = await listedPlace(word);
    await addRoom(listed.business.id);
    const unlisted = await createPlace(`Beit ${word} hidden`);
    await addRoom(unlisted.business.id);
    const paused = await listedPlace(word);
    await addRoom(paused.business.id);
    await prisma.business.update({ where: { id: paused.business.id }, data: { status: "SUSPENDED" } });
    const deleted = await listedPlace(word);
    await addRoom(deleted.business.id);
    await prisma.business.update({ where: { id: deleted.business.id }, data: { isDeleted: true } });

    expect(slugs(await search(word))).toEqual([listed.business.slug]);
  });

  it('finds the places in a region\'s towns, by "North Lebanon" or "الشمال"', async () => {
    const word = randomUUID().slice(0, 8);
    const ehden = await listedPlace(word, { area: "Ehden" });
    await addRoom(ehden.business.id);
    const stored = await listedPlace(word, { region: "north" });
    await addRoom(stored.business.id);
    const beirut = await listedPlace(word, { area: "Gemmayzeh", region: "beirut" });
    await addRoom(beirut.business.id);

    for (const area of ["North Lebanon", "الشمال"]) {
      expect(slugs(await search(word, { area })).sort()).toEqual(
        [ehden.business.slug, stored.business.slug].sort(),
      );
    }
    expect(slugs(await search(word, { area: "Ehden" }))).toEqual([ehden.business.slug]);
  });

  it("filters the rooms by guests, bedrooms, bathrooms and amenities, and shows what was found", async () => {
    const word = randomUUID().slice(0, 8);
    const { business } = await listedPlace(word);
    const small = await addRoom(business.id, { capacity: 2 });
    const suite = await addRoom(business.id, { capacity: 4 });
    await prisma.room.update({
      where: { id: suite.id },
      data: { bedrooms: 2, bathrooms: 2, amenities: ["jacuzzi", "wifi"] },
    });

    const [card] = await search(word, { guests: 3, minBedrooms: 2, minBathrooms: 2, amenities: ["jacuzzi"] });
    expect(card?.offers).toEqual([
      expect.objectContaining({ roomId: suite.id, capacity: 4, bedrooms: 2, bathrooms: 2 }),
    ]);
    expect(card?.offers[0]?.amenities).toContain("jacuzzi");
    expect(slugs(await search(word, { guests: 2 }))).toEqual([business.slug]);
    expect((await search(word, { guests: 2 }))[0]?.offers.map((offer) => offer.roomId)).toContain(small.id);
  });

  it("returns nothing rather than a near miss", async () => {
    const word = randomUUID().slice(0, 8);
    const { business } = await listedPlace(word);
    await addRoom(business.id, { capacity: 2, baseRateCents: 10_000 });

    expect(await search(word, { guests: 3 })).toEqual([]);
    expect(await search(word, { amenities: ["jacuzzi"] })).toEqual([]);
    expect(await search(word, { maxRateCents: 9_999 })).toEqual([]);
    expect(await search(word, { area: "Tyre" })).toEqual([]);
  });

  it("filters the place by its categories, tags and accessibility", async () => {
    const word = randomUUID().slice(0, 8);
    const category = await prisma.category.create({
      data: { slug: `c-${randomUUID().slice(0, 8)}`, nameEn: "Mountain", nameAr: "جبل", icon: "mountain" },
    });
    const tagged = await listedPlace(word);
    await prisma.business.update({
      where: { id: tagged.business.id },
      data: {
        tags: ["family-friendly"],
        accessibility: ["step-free-access"],
        categories: { create: { categorySlug: category.slug } },
      },
    });
    await addRoom(tagged.business.id);
    const plain = await listedPlace(word);
    await addRoom(plain.business.id);

    expect(slugs(await search(word, { categories: [category.slug] }))).toEqual([tagged.business.slug]);
    expect(slugs(await search(word, { tags: ["family-friendly"] }))).toEqual([tagged.business.slug]);
    expect(slugs(await search(word, { accessibility: ["step-free-access"] }))).toEqual([
      tagged.business.slug,
    ]);
    expect((await search(word, { categories: [category.slug] }))[0]?.categories).toEqual([category.slug]);
  });

  it("with dates, shows only free rooms the stay fits, priced night by night", async () => {
    const word = randomUUID().slice(0, 8);
    const place = await listedPlace(word);
    const { business, ctx } = place;
    const closed = await addRoom(business.id, { baseRateCents: 5_000 });
    const free = await addRoom(business.id, { baseRateCents: 9_000 });
    const longStays = await addRoom(business.id, { baseRateCents: 4_000, minNights: 5 });
    const range = stay(10, 2);
    await addBlock(ctx, { roomId: closed.id, range, note: null });
    await prisma.rateOverride.create({
      data: { businessId: business.id, roomId: free.id, date: range.checkIn, rateCents: 12_000 },
    });

    const [card] = await search(word, { range });
    expect(card?.offers.map((offer) => offer.roomId)).toEqual([free.id]);
    expect(card).toMatchObject({ nightlyFromCents: 9_000, stayTotalFromCents: 21_000 });

    // Without dates every room counts, at its base price, cheapest first.
    const [any] = await search(word);
    expect(any?.offers.map((offer) => offer.roomId)).toEqual([longStays.id, closed.id, free.id]);
    expect(any).toMatchObject({ nightlyFromCents: 4_000, stayTotalFromCents: null });
  });

  it("leaves out a place whose only room is taken, and never offers a past stay", async () => {
    const word = randomUUID().slice(0, 8);
    const { business, ctx } = await listedPlace(word);
    const room = await addRoom(business.id);
    const range = stay(3, 2);
    await addBlock(ctx, { roomId: room.id, range, note: null });

    expect(await search(word, { range })).toEqual([]);
    expect(await search(word, { range: stay(-3, 2) })).toEqual([]);
    expect(
      slugs(await search(word, { range: { checkIn: range.checkOut, checkOut: addDays(range.checkOut, 1) } })),
    ).toEqual([business.slug]);
  });

  it("finds a place booked whole by its whole-place unit, which takes turns with its rooms", async () => {
    const word = randomUUID().slice(0, 8);
    const { business, ctx } = await listedPlace(word);
    await prisma.business.update({ where: { id: business.id }, data: { bookingUnit: "WHOLE_PLACE" } });
    const room = await addRoom(business.id, { capacity: 2 });
    const whole = await addRoom(business.id, { kind: "WHOLE_PLACE", capacity: 6 });

    const [card] = await search(word, { guests: 5 });
    expect(card?.offers.map((offer) => offer.roomId)).toEqual([whole.id]);

    const range = stay(20, 2);
    await addBlock(ctx, { roomId: room.id, range, note: null });
    expect(await search(word, { range })).toEqual([]);
  });

  it("shows the place's own first photo, else its room's", async () => {
    const word = randomUUID().slice(0, 8);
    const withOwn = await listedPlace(word);
    const room = await addRoom(withOwn.business.id);
    await prisma.photo.create({
      data: {
        businessId: withOwn.business.id,
        roomId: room.id,
        url: "https://example.test/room.jpg",
        position: 0,
      },
    });
    const own = await prisma.photo.create({
      data: { businessId: withOwn.business.id, url: "https://example.test/own.jpg", position: 0 },
    });
    const roomsOnly = await listedPlace(`${word}x`);
    const onlyRoom = await addRoom(roomsOnly.business.id);
    const roomPhoto = await prisma.photo.create({
      data: {
        businessId: roomsOnly.business.id,
        roomId: onlyRoom.id,
        url: "https://example.test/r.jpg",
        position: 0,
      },
    });

    expect((await search(withOwn.business.name))[0]?.photo?.id).toBe(own.id);
    expect((await search(`${word}x`))[0]?.photo?.id).toBe(roomPhoto.id);
  });
});
