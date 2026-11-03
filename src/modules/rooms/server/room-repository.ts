import type { PhotoArea, Prisma, RoomKind } from "@prisma/client";
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

/** What a guest can ask of a unit in search; each filter left out is not checked. */
export interface UnitFilters {
  /** It sleeps at least this many. */
  guests: number;
  /** Its base price per night is within these, in minor units. */
  minRateCents?: number;
  maxRateCents?: number;
  /** It has every one of these amenities. */
  amenities?: readonly string[];
  minBedrooms?: number;
  minBathrooms?: number;
  minBeds?: number;
}

/**
 * For search: the live units of these places, each place's of the kind it is booked by, that match every filter,
 * with their first photo. One query however many places.
 */
export function findSearchUnits(
  db: Db,
  places: ReadonlyArray<{ businessId: string; kind: RoomKind }>,
  filters: UnitFilters,
) {
  if (places.length === 0) return Promise.resolve([]);
  return db.room.findMany({
    where: {
      OR: places.map(({ businessId, kind }) => ({ businessId, kind })),
      active: true,
      isDeleted: false,
      capacity: { gte: filters.guests },
      baseRateCents:
        filters.minRateCents === undefined && filters.maxRateCents === undefined
          ? undefined
          : { gte: filters.minRateCents, lte: filters.maxRateCents },
      amenities: filters.amenities?.length ? { hasEvery: [...filters.amenities] } : undefined,
      bedrooms: filters.minBedrooms ? { gte: filters.minBedrooms } : undefined,
      bathrooms: filters.minBathrooms ? { gte: filters.minBathrooms } : undefined,
      beds: filters.minBeds ? { gte: filters.minBeds } : undefined,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      businessId: true,
      name: true,
      capacity: true,
      bedrooms: true,
      beds: true,
      bathrooms: true,
      baseRateCents: true,
      minNights: true,
      amenities: true,
      photos: { ...publicPhoto, take: 1 },
    },
  });
}

type PublicPhotoRow = { id: string; url: string; alt: string | null; area: PhotoArea | null };

/** The first photo of each place's own gallery (not a room's), in the host's order, for search's result cards. */
export async function findPlaceCovers(db: Db, businessIds: readonly string[]) {
  if (businessIds.length === 0) return new Map<string, PublicPhotoRow>();
  const photos = await db.photo.findMany({
    where: { businessId: { in: [...businessIds] }, roomId: null, offeringId: null, isDeleted: false },
    orderBy: publicPhoto.orderBy,
    select: { ...publicPhoto.select, businessId: true },
  });
  const covers = new Map<string, PublicPhotoRow>();
  for (const { businessId, ...photo } of photos) if (!covers.has(businessId)) covers.set(businessId, photo);
  return covers;
}

/** The special prices of many rooms on the nights of a stay, by room then ISO date. One query. */
export async function findRateOverridesForRooms(db: Db, roomIds: readonly string[], range: DateRange) {
  const overrides = await db.rateOverride.findMany({
    where: {
      roomId: { in: [...roomIds] },
      date: { gte: range.checkIn, lt: range.checkOut },
      isDeleted: false,
    },
    select: { roomId: true, date: true, rateCents: true },
  });
  const byRoom = new Map<string, Map<string, number>>();
  for (const override of overrides) {
    const rates = byRoom.get(override.roomId) ?? new Map<string, number>();
    rates.set(toIsoDate(override.date), override.rateCents);
    byRoom.set(override.roomId, rates);
  }
  return byRoom;
}
