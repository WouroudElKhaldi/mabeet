import { findRoomForBooking, findRoomUnits, hasWholePlaceUnit } from "@/modules/rooms/server";
import { prisma } from "@/server/db/client";
import { invalid, notFound } from "@/server/errors";
import { addDays, countNights, type DateRange, toIsoDate } from "@/utils/dates";
import * as bookings from "./booking-repository";

// Public availability: which nights guests cannot book. It reads the same night rows as a new booking checks, with
// holds whose time ran out already free, so what a guest sees free is what `requestBooking` will accept (bar a
// guest who takes it a moment earlier). Dates only: never who stays or why a night is taken.

/** Longest range one read may ask about: a year of nights is enough for any calendar a guest scrolls. */
const MAX_NIGHTS = 366;
/** Most rooms one search may check at once. */
const MAX_ROOMS = 500;

function assertReadableRange(range: DateRange) {
  const nights = countNights(range);
  if (nights < 1) throw invalid("Check-out must be after check-in");
  if (nights > MAX_NIGHTS) throw invalid(`Ask about ${MAX_NIGHTS} nights at most`);
}

/**
 * The nights in `range` (ISO dates, check-out night not included) that a guest cannot book in this room: confirmed
 * stays, live holds, platform stays and closed dates. At a place that can also be booked whole, a room's nights
 * include the whole place's, and the whole place's include every room's. No sign-in needed.
 */
export async function getTakenNights(
  businessId: string,
  roomId: string,
  range: DateRange,
  now = new Date(),
): Promise<string[]> {
  assertReadableRange(range);
  const unit = await findRoomForBooking(businessId, roomId);
  if (!unit) throw notFound("Room");
  const acrossUnits = await hasWholePlaceUnit(businessId);
  const stays = await bookings.listTakenStays(prisma, unit, range, now, acrossUnits);

  const taken = new Set<string>();
  for (const stay of stays) {
    // Only the nights inside the range asked about.
    const from = stay.checkIn > range.checkIn ? stay.checkIn : range.checkIn;
    const to = stay.checkOut < range.checkOut ? stay.checkOut : range.checkOut;
    for (let night = from; night < to; night = addDays(night, 1)) taken.add(toIsoDate(night));
  }
  return [...taken].sort();
}

/**
 * For search: which of these rooms are free on every night of `range`, following the whole-place unit like
 * `getTakenNights`. Two queries however many rooms are asked about. Unknown, closed or deleted rooms are never free.
 */
export async function findFreeRooms(
  roomIds: string[],
  range: DateRange,
  now = new Date(),
): Promise<string[]> {
  assertReadableRange(range);
  if (roomIds.length > MAX_ROOMS) throw invalid(`Check ${MAX_ROOMS} rooms at most`);
  if (roomIds.length === 0) return [];
  const units = await findRoomUnits(roomIds);
  if (units.length === 0) return [];

  const taken = await bookings.listTakenUnits(
    prisma,
    [...new Set(units.map((unit) => unit.businessId))],
    range,
    now,
  );
  const takenUnits = new Set(taken.map((row) => row.roomId));
  const wholePlaceTaken = new Set(
    taken.filter((row) => row.room.kind === "WHOLE_PLACE").map((row) => row.businessId),
  );
  const roomTaken = new Set(taken.filter((row) => row.room.kind === "ROOM").map((row) => row.businessId));

  return units
    .filter((unit) => {
      if (takenUnits.has(unit.id)) return false;
      // The whole place takes turns with its rooms.
      return unit.kind === "ROOM" ? !wholePlaceTaken.has(unit.businessId) : !roomTaken.has(unit.businessId);
    })
    .map((unit) => unit.id);
}
