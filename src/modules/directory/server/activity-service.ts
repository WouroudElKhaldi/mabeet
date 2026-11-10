import { listPersonActivity } from "@/modules/audit/server";
import { listMyBookings } from "@/modules/bookings/server";
import { listPlacesByIds } from "@/modules/workspaces/server";
import { isActivityAction } from "@/config/activity";
import type { ActivityItem } from "../types";

// A guest's own timeline, as their account's Activity page tells it: what they did (asked for a stay, saved a
// place, wrote a review) and what happened to them (a host confirmed or declined, a request ran out).

/** The most entries the page shows: enough to look back over a year of trips. */
const SHOWN = 100;

/**
 * The guest's timeline, newest first, each line with the place it was about and where it leads: the booking's page
 * for a stay, the place's page otherwise. A place that has since closed keeps its line, without a link.
 */
export async function listMyActivity(userId: string): Promise<ActivityItem[]> {
  const [entries, bookings] = await Promise.all([listPersonActivity(userId, SHOWN), listMyBookings(userId)]);
  const stays = new Map(bookings.map((booking) => [booking.id, booking]));
  const placeIds = [
    ...new Set(
      entries.flatMap((entry) => (entry.entity === "booking" || !entry.businessId ? [] : [entry.businessId])),
    ),
  ];
  const places = new Map((await listPlacesByIds(placeIds)).map((place) => [place.id, place]));

  return entries.flatMap((entry) => {
    if (!isActivityAction(entry.action)) return [];
    const stay = entry.entity === "booking" && entry.entityId ? stays.get(entry.entityId) : undefined;
    const place = entry.businessId ? places.get(entry.businessId) : undefined;
    return [
      {
        id: entry.id,
        action: entry.action,
        at: entry.createdAt.toISOString(),
        placeName: stay?.business.name ?? place?.name ?? null,
        href: stay ? `/b/${stay.publicToken}` : place ? `/p/${place.slug}` : null,
        reference: stay?.reference ?? null,
      },
    ];
  });
}
