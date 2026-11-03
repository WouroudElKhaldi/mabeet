import { isActiveBooking } from "@/config/enums";
import type { GuestTrip } from "./types";

/**
 * A guest's stays as two lists. Upcoming: still alive (waiting for payment or the host, or confirmed) and not yet over,
 * soonest first. Past: everything else (over, declined, expired, cancelled), most recent first. A stay is over on its
 * check-out day: the guest has left.
 */
export function splitTrips(trips: readonly GuestTrip[], today: string) {
  const upcoming = trips
    .filter((trip) => isActiveBooking(trip.status) && trip.checkOut > today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const upcomingTokens = new Set(upcoming.map((trip) => trip.publicToken));
  const past = trips
    .filter((trip) => !upcomingTokens.has(trip.publicToken))
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  return { upcoming, past };
}
