import type { Db } from "@/server/db/client";
import { type DateRange, toIsoDate } from "@/utils/dates";

// Rooms and their special prices.

/** What a booking needs to know about a room: whether it fits the guests and the stay, and its price. */
export function findRoomForBooking(db: Db, businessId: string, roomId: string) {
  return db.room.findFirst({
    where: { id: roomId, businessId, isDeleted: false },
    select: {
      id: true,
      businessId: true,
      name: true,
      kind: true,
      capacity: true,
      minNights: true,
      baseRateCents: true,
    },
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
