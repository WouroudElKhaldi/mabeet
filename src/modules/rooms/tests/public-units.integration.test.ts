import { describe, expect, it } from "vitest";
import { addRoom, createPlace, prisma } from "@tests/integration/helpers";
import { listPlacePhotos, listPublicUnits } from "../server";

// A place's public page shows the units guests can book, with their photos in the host's order, and never a room's
// private calendar link.

const photo = (businessId: string, data: { roomId?: string; position: number; isDeleted?: boolean }) =>
  prisma.photo.create({
    data: { businessId, url: `https://example.test/${crypto.randomUUID()}.jpg`, alt: "Terrace", ...data },
  });

describe("a place's public units", () => {
  it("lists the live units of the kind asked for, with their photos in order and no export token", async () => {
    const { business } = await createPlace();
    const first = await addRoom(business.id, { capacity: 2, baseRateCents: 9_000 });
    const second = await addRoom(business.id);
    const closed = await addRoom(business.id);
    await prisma.room.update({ where: { id: closed.id }, data: { active: false } });
    const deleted = await addRoom(business.id);
    await prisma.room.update({ where: { id: deleted.id }, data: { isDeleted: true } });
    const wholePlace = await addRoom(business.id, { kind: "WHOLE_PLACE", capacity: 8 });
    const later = await photo(business.id, { roomId: first.id, position: 2 });
    const earlier = await photo(business.id, { roomId: first.id, position: 1 });
    await photo(business.id, { roomId: first.id, position: 0, isDeleted: true });

    const units = await listPublicUnits(business.id, "ROOM");
    expect(units.map((unit) => unit.id)).toEqual([first.id, second.id]);
    const [shown] = units;
    expect(shown).toMatchObject({ id: first.id, capacity: 2, baseRateCents: 9_000, kind: "ROOM" });
    expect(shown?.photos.map((picture) => picture.id)).toEqual([earlier.id, later.id]);
    expect(shown).not.toHaveProperty("exportToken");
    expect(shown?.photos[0]).toEqual({ id: earlier.id, url: earlier.url, alt: "Terrace", area: null });

    // A place that books whole shows its one whole-place unit, never its rooms.
    expect((await listPublicUnits(business.id, "WHOLE_PLACE")).map((unit) => unit.id)).toEqual([
      wholePlace.id,
    ]);
  });

  it("lists the place's own photos in order, without a room's", async () => {
    const { business } = await createPlace();
    const room = await addRoom(business.id);
    const second = await photo(business.id, { position: 1 });
    const first = await photo(business.id, { position: 0 });
    await photo(business.id, { roomId: room.id, position: 0 });
    await photo(business.id, { position: 2, isDeleted: true });

    expect((await listPlacePhotos(business.id)).map((picture) => picture.id)).toEqual([first.id, second.id]);
  });
});
