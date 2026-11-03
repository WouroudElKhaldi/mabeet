import type { Prisma, RoomKind } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";
import { type DateRange, toIsoDate } from "@/utils/dates";

// The calendar link's secret is only for the calendar's own routes, never in a room's ordinary read.
const roomOmit = { exportToken: true, isDeleted: true } satisfies Prisma.RoomOmit;

export function listRooms(db: Db, businessId: string) {
  return db.room.findMany({
    where: { businessId, isDeleted: false },
    omit: roomOmit,
    orderBy: { createdAt: "asc" },
  });
}

export function findRoom(db: Db, businessId: string, roomId: string) {
  return db.room.findFirst({ where: { id: roomId, businessId, isDeleted: false }, omit: roomOmit });
}

export function createRoom(db: Db, data: Prisma.RoomUncheckedCreateInput) {
  return db.room.create({ data, omit: roomOmit });
}

/** The place's one whole-place unit, if it ever had one (taken off or deleted included: it is brought back, never doubled). */
export function findWholePlaceUnit(db: Db, businessId: string) {
  return db.room.findFirst({
    where: { businessId, kind: "WHOLE_PLACE" },
    select: { id: true, active: true, isDeleted: true },
  });
}

/** Brings a whole-place unit that was taken off or deleted back into use. */
export function restoreWholePlaceUnit(tx: Tx, businessId: string, roomId: string) {
  return tx.room.updateMany({
    where: { id: roomId, businessId, kind: "WHOLE_PLACE" },
    data: { active: true, isDeleted: false },
  });
}

/** The place's live rooms added up, to start its whole-place unit from. */
export function sumRooms(db: Db, businessId: string) {
  return db.room.aggregate({
    where: { businessId, kind: "ROOM", active: true, isDeleted: false },
    _sum: { capacity: true, bedrooms: true, beds: true, bathrooms: true, baseRateCents: true },
  });
}

export async function updateRoom(
  db: Db,
  businessId: string,
  roomId: string,
  data: Prisma.RoomUncheckedUpdateManyInput,
) {
  const { count } = await db.room.updateMany({ where: { id: roomId, businessId, isDeleted: false }, data });
  return count > 0;
}

export function listSpecialPrices(db: Db, businessId: string, roomId: string, from: Date) {
  return db.rateOverride.findMany({
    where: { businessId, roomId, date: { gte: from }, isDeleted: false },
    select: { date: true, rateCents: true },
    orderBy: { date: "asc" },
  });
}

/**
 * Saves one price on each of these nights. A night has one row (unique on room and date), so a night set before,
 * or cleared before, gets its row back with the new price; the rest are created. Two statements whatever the range,
 * instead of one upsert per night.
 */
export async function setSpecialPrices(
  db: Db,
  businessId: string,
  roomId: string,
  nights: Date[],
  rateCents: number,
) {
  await db.rateOverride.updateMany({
    where: { businessId, roomId, date: { in: nights } },
    data: { rateCents, isDeleted: false },
  });
  await db.rateOverride.createMany({
    data: nights.map((date) => ({ businessId, roomId, date, rateCents })),
    skipDuplicates: true,
  });
}

export function clearSpecialPrices(db: Db, businessId: string, roomId: string, range: DateRange) {
  return db.rateOverride.updateMany({
    where: { businessId, roomId, date: { gte: range.checkIn, lt: range.checkOut }, isDeleted: false },
    data: { isDeleted: true },
  });
}

// What the booking engine reads about a room (through room-lookup.ts), inside its own transaction.

/** What a booking needs to know about a room: whether it fits the guests and the stay, and its price. */
export function findRoomForBooking(db: Db, businessId: string, roomId: string) {
  return db.room.findFirst({
    where: { id: roomId, businessId, isDeleted: false },
    select: {
      id: true,
      businessId: true,
      name: true,
      kind: true,
      active: true,
      capacity: true,
      minNights: true,
      baseRateCents: true,
    },
  });
}

/** For search: the place and kind of each live room in `roomIds`, in one query. Unknown or closed rooms are left out. */
export function findRoomUnits(db: Db, roomIds: string[]) {
  return db.room.findMany({
    where: { id: { in: roomIds }, active: true, isDeleted: false },
    select: { id: true, businessId: true, kind: true },
  });
}

/** What a visitor may see of a photo, in the host's order. */
const publicPhoto = {
  where: { isDeleted: false },
  orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  select: { id: true, url: true, alt: true, area: true },
} satisfies Prisma.Room$photosArgs;

/**
 * A place's units guests can see, of one kind (its rooms, or its whole-place unit), with their photos. Never the
 * calendar export token: it is the room's private link to Airbnb and Booking.com.
 */
export function listPublicUnits(db: Db, businessId: string, kind: RoomKind) {
  return db.room.findMany({
    where: { businessId, kind, active: true, isDeleted: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      kind: true,
      capacity: true,
      bedrooms: true,
      beds: true,
      bathrooms: true,
      baseRateCents: true,
      minNights: true,
      amenities: true,
      photos: publicPhoto,
    },
  });
}

/** The photos of the place itself (not of a room or an experience), in the host's order. */
export function listPlacePhotos(db: Db, businessId: string) {
  return db.photo.findMany({
    where: { businessId, roomId: null, offeringId: null, isDeleted: false },
    orderBy: publicPhoto.orderBy,
    select: publicPhoto.select,
  });
}

/** Whether the place can also be booked whole, so its bookings must be checked across all its units. */
export async function hasWholePlaceUnit(db: Db, businessId: string): Promise<boolean> {
  return (await db.room.count({ where: { businessId, kind: "WHOLE_PLACE", isDeleted: false } })) > 0;
}

/** A room's special prices on the nights of a stay, keyed by ISO date. */
export async function findRateOverrides(db: Db, businessId: string, roomId: string, range: DateRange) {
  const overrides = await db.rateOverride.findMany({
    where: { businessId, roomId, date: { gte: range.checkIn, lt: range.checkOut }, isDeleted: false },
    select: { date: true, rateCents: true },
  });
  return new Map(overrides.map((override) => [toIsoDate(override.date), override.rateCents]));
}

/** For the calendar: every room the place has not deleted, its rooms first and then its whole-place unit. */
export function listRoomNames(db: Db, businessId: string) {
  return db.room.findMany({
    where: { businessId, isDeleted: false },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, kind: true, active: true },
  });
}

/** For analytics: how many live units of one kind a place has, the nights it could sell each night. */
export function countActiveUnits(db: Db, businessId: string, kind: RoomKind) {
  return db.room.count({ where: { businessId, kind, active: true, isDeleted: false } });
}
