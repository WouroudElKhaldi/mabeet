import { listPersonActivity } from "@/modules/audit/server";
import { listMyBookings, listMySessionBookings } from "@/modules/bookings/server";
import { listPlacesByIds } from "@/modules/workspaces/server";
import { isActivityAction } from "@/config/activity";
import type { ActivityItem } from "../types";

// A guest's own timeline, as their account's Activity page tells it: what they did (asked for a stay, saved a
// place, wrote a review) and what happened to them (a host confirmed or declined, a request ran out).

/** The most entries the page shows: enough to look back over a year of trips. */
const SHOWN = 100;

/** Log entries about a booking: a stay, or seats in a session. */
const BOOKING_ENTITIES = new Set(["booking", "session_booking"]);

/**
 * The guest's timeline, newest first, each line with the place it was about and where it leads: the booking's page
 * for a stay or seats, the place's page otherwise. A place that has since closed keeps its line, without a link.
 */
export async function listMyActivity(userId: string): Promise<ActivityItem[]> {
  const [entries, stays, seats] = await Promise.all([
    listPersonActivity(userId, SHOWN),
    listMyBookings(userId),
    listMySessionBookings(userId),
  ]);
  const bookings = new Map([...stays, ...seats].map((booking) => [booking.id, booking]));
  const placeIds = [
    ...new Set(
      entries.flatMap((entry) =>
        BOOKING_ENTITIES.has(entry.entity) || !entry.businessId ? [] : [entry.businessId],
      ),
    ),
  ];
  const places = new Map((await listPlacesByIds(placeIds)).map((place) => [place.id, place]));

  return entries.flatMap((entry) => {
    if (!isActivityAction(entry.action)) return [];
    const booking =
      BOOKING_ENTITIES.has(entry.entity) && entry.entityId ? bookings.get(entry.entityId) : undefined;
    const place = entry.businessId ? places.get(entry.businessId) : undefined;
    return [
      {
        id: entry.id,
        action: entry.action,
        at: entry.createdAt.toISOString(),
        placeName: booking?.business.name ?? place?.name ?? null,
        href: booking ? `/b/${booking.publicToken}` : place ? `/p/${place.slug}` : null,
        reference: booking?.reference ?? null,
      },
    ];
  });
}
