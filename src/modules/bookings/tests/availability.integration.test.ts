import { describe, expect, it, vi } from "vitest";
import { addRoom, prisma, stay } from "@tests/integration/helpers";
import { addDays, type DateRange, toIsoDate } from "@/utils/dates";
import { addBlock, cancelBooking, findFreeRooms, getTakenNights, requestBooking } from "../server";
import { importStay, placeWithRoom, requestFor } from "./fixtures";

// Public availability: the nights guests cannot book, as the place page, the booking box and search read them. It
// must agree with what a new booking accepts, follow the whole-place unit both ways, and never reveal more than dates.

/** The ISO nights of a stay, check-out night not included. */
const nightsOf = (range: DateRange) => {
  const nights: string[] = [];
  for (let night = range.checkIn; night < range.checkOut; night = addDays(night, 1))
    nights.push(toIsoDate(night));
  return nights;
};

describe("the nights a room cannot be booked", () => {
  it("counts held and confirmed stays, platform stays and closed dates, inside the range asked about", async () => {
    const place = await placeWithRoom();
    const booked = stay(5, 2);
    const closed = stay(10, 1);
    const imported = stay(12, 2);
    await requestBooking(requestFor(place, booked));
    await addBlock(place.ctx, { roomId: place.room.id, range: closed, note: "Painting" });
    await importStay(place, place.room.id, imported);

    const month = stay(0, 30);
    expect(await getTakenNights(place.business.id, place.room.id, month)).toEqual([
      ...nightsOf(booked),
      ...nightsOf(closed),
      ...nightsOf(imported),
    ]);
    // Only nights inside the range: the booking's first night is before it, and the imported stay runs past it.
    expect(await getTakenNights(place.business.id, place.room.id, stay(6, 7))).toEqual([
      ...nightsOf(stay(6, 1)),
      ...nightsOf(closed),
      ...nightsOf(stay(12, 1)),
    ]);
  });

  it("frees the nights of a cancelled booking, and of a hold whose time ran out, at once", async () => {
    const place = await placeWithRoom();
    const cancelled = await requestBooking(requestFor(place, stay(5, 2)));
    await cancelBooking(place.ctx, { bookingId: cancelled.id });
    const held = await requestBooking(requestFor(place, stay(9, 2)));
    const month = stay(0, 30);
    expect(await getTakenNights(place.business.id, place.room.id, month)).toEqual(nightsOf(stay(9, 2)));

    // Housekeeping has not run yet, but a read after the hold's end already counts the nights as free, like a new
    // booking would.
    const afterHold = new Date((held.holdExpiresAt ?? new Date()).getTime() + 60_000);
    expect(await getTakenNights(place.business.id, place.room.id, month, afterHold)).toEqual([]);
    await expect(findFreeRooms([place.room.id], stay(9, 2), afterHold)).resolves.toEqual([place.room.id]);
  });

  it("follows the whole-place unit both ways", async () => {
    const place = await placeWithRoom();
    const otherRoom = await addRoom(place.business.id);
    const wholePlace = await addRoom(place.business.id, { kind: "WHOLE_PLACE", capacity: 8 });
    const roomNights = stay(5, 2);
    const wholeNights = stay(10, 2);
    await requestBooking(requestFor(place, roomNights));
    await addBlock(place.ctx, { roomId: wholePlace.id, range: wholeNights, note: null });
    const month = stay(0, 30);

    // A room's stay takes the whole place; the other room stays free on those nights.
    expect(await getTakenNights(place.business.id, wholePlace.id, month)).toEqual([
      ...nightsOf(roomNights),
      ...nightsOf(wholeNights),
    ]);
    expect(await getTakenNights(place.business.id, otherRoom.id, month)).toEqual(nightsOf(wholeNights));
    expect(await getTakenNights(place.business.id, place.room.id, month)).toEqual([
      ...nightsOf(roomNights),
      ...nightsOf(wholeNights),
    ]);

    const units = [place.room.id, otherRoom.id, wholePlace.id];
    expect((await findFreeRooms(units, roomNights)).sort()).toEqual([otherRoom.id]);
    expect(await findFreeRooms(units, wholeNights)).toEqual([]);
    expect((await findFreeRooms(units, stay(20, 2))).sort()).toEqual([...units].sort());
  });

  it("refuses a room of another place, an unknown room and ranges it cannot answer", async () => {
    const place = await placeWithRoom();
    const other = await placeWithRoom();
    await expect(getTakenNights(place.business.id, other.room.id, stay(0, 5))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(getTakenNights(place.business.id, "no-such-room", stay(0, 5))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const backwards = { checkIn: stay(5, 1).checkIn, checkOut: stay(2, 1).checkIn };
    await expect(getTakenNights(place.business.id, place.room.id, backwards)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(getTakenNights(place.business.id, place.room.id, stay(0, 400))).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("which rooms are free, for search", () => {
  it("checks rooms across places at once and leaves out unknown, closed and deleted rooms", async () => {
    const first = await placeWithRoom();
    const second = await placeWithRoom();
    const closedRoom = await addRoom(first.business.id);
    await prisma.room.update({ where: { id: closedRoom.id }, data: { active: false } });
    const deletedRoom = await addRoom(second.business.id);
    await prisma.room.update({ where: { id: deletedRoom.id }, data: { isDeleted: true } });
    const nights = stay(7, 3);
    await importStay(second, second.room.id, stay(8, 1));

    const free = await findFreeRooms(
      [first.room.id, second.room.id, closedRoom.id, deletedRoom.id, "no-such-room"],
      nights,
    );
    expect(free).toEqual([first.room.id]);
    // It agrees with the per-room read.
    expect(await getTakenNights(second.business.id, second.room.id, nights)).toEqual(nightsOf(stay(8, 1)));
    await expect(findFreeRooms([], nights)).resolves.toEqual([]);
  });

  it("reads the taken nights of every place in one query, however many rooms are asked about", async () => {
    const places = await Promise.all([placeWithRoom(), placeWithRoom(), placeWithRoom()]);
    const occupancyReads = vi.spyOn(prisma.occupancy, "findMany");
    try {
      await findFreeRooms(
        places.map((place) => place.room.id),
        stay(7, 3),
      );
      expect(occupancyReads).toHaveBeenCalledTimes(1);
    } finally {
      occupancyReads.mockRestore();
    }
  });
});
