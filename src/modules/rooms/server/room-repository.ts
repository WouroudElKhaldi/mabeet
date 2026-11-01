import type { Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";
import type { DateRange } from "@/utils/dates";

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
