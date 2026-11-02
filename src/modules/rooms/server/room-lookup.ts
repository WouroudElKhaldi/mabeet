import { type Db, prisma } from "@/server/db/client";
import type { DateRange } from "@/utils/dates";
import { quoteStay, type StayQuote } from "./pricing";
import * as rooms from "./room-repository";

// What other modules read about a room. The booking engine calls these inside its own transaction, with the room
// already locked, so it passes its `tx`.

export function findRoomForBooking(businessId: string, roomId: string, db: Db = prisma) {
  return rooms.findRoomForBooking(db, businessId, roomId);
}

export function findRoomUnits(roomIds: string[], db: Db = prisma) {
  return rooms.findRoomUnits(db, roomIds);
}

export function hasWholePlaceUnit(businessId: string, db: Db = prisma) {
  return rooms.hasWholePlaceUnit(db, businessId);
}

/** The price of a stay in a room: its base price, or each night's special price. */
export async function priceStay(
  room: { id: string; businessId: string; baseRateCents: number },
  range: DateRange,
  db: Db = prisma,
): Promise<StayQuote> {
  const overrides = await rooms.findRateOverrides(db, room.businessId, room.id, range);
  return quoteStay({ range, baseRateCents: room.baseRateCents, overrides });
}
