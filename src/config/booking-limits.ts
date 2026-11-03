import type { BookingUnit, RoomKind } from "@prisma/client";

// How far and how long a guest can book. The booking engine enforces them when a booking is made, and the calendar
// and the price check read the same numbers, so a guest is never offered a stay the engine would refuse.

/** The longest stay, in nights. */
export const MAX_STAY_NIGHTS = 60;

/** How many days ahead a stay may begin. */
export const MAX_DAYS_AHEAD = 540;

/** Why a stay cannot be booked as asked. The screen turns each into a sentence in the guest's language. */
export const STAY_ISSUES = ["PAST", "TOO_FAR", "TOO_LONG", "MIN_NIGHTS", "CAPACITY"] as const;
export type StayIssue = (typeof STAY_ISSUES)[number];

/** The kind of room a place books by: its rooms one by one, or the whole place as one unit. */
export const BOOKABLE_ROOM_KIND = {
  ROOMS: "ROOM",
  WHOLE_PLACE: "WHOLE_PLACE",
} as const satisfies Record<BookingUnit, RoomKind>;
