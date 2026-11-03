import type { RoomKind } from "@prisma/client";
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

/**
 * For a place's public page: its live units of the kind it books by (`BOOKABLE_ROOM_KIND[place.bookingUnit]`), with
 * their photos in order. A unit of the other kind could not be booked, so it is never shown.
 */
export function listPublicUnits(businessId: string, kind: RoomKind, db: Db = prisma) {
  return rooms.listPublicUnits(db, businessId, kind);
}

/** For a place's public page: the photos of the place itself, in order, for the gallery and the photo tour. */
export function listPlacePhotos(businessId: string, db: Db = prisma) {
  return rooms.listPlacePhotos(db, businessId);
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

/** For analytics: the live units of the kind a place is booked by, so occupancy is out of the right number. */
export function countActiveUnits(businessId: string, kind: RoomKind, db: Db = prisma) {
  return rooms.countActiveUnits(db, businessId, kind);
}
