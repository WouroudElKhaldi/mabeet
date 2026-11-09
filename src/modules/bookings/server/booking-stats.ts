import type { RoomKind } from "@prisma/client";
import { prisma } from "@/server/db/client";
import type { DateRange } from "@/utils/dates";
import * as stats from "./booking-stats-repository";

// What analytics reads about a place's nights and bookings. Plain reads by business: the caller checks the member's
// permission first (analytics.read, or bookings.read for "All my places").

export type { ChannelNights, MonthlyNights, MonthlyRevenue } from "./booking-stats-repository";

/**
 * A place's nights and money over a period: sold nights by channel and by month (on the units of `kind`, the kind it
 * is booked by), confirmed direct revenue (in all, and by the month stays begin), requests by outcome and the host's
 * typical answer time.
 */
export async function getStayNumbers(businessId: string, kind: RoomKind, range: DateRange) {
  const [channels, monthly, monthlyRevenue, directRevenueCents, requests, medianResponseMinutes] =
    await Promise.all([
      stats.soldNightsByChannel(prisma, businessId, kind, range),
      stats.soldNightsByMonth(prisma, businessId, kind, range),
      stats.revenueByMonth(prisma, businessId, range),
      stats.directRevenueCents(prisma, businessId, range),
      stats.requestsByStatus(prisma, businessId, range),
      stats.medianResponseMinutes(prisma, businessId, range),
    ]);
  return {
    channels,
    monthly,
    monthlyRevenue,
    directRevenueCents,
    requests: Object.fromEntries(requests.map((row) => [row.status, row._count._all])),
    medianResponseMinutes,
  };
}

/**
 * How the host answers the requests that waited for them since `since`: how many, how many they answered, and their
 * typical answer time. Public facts about a place, shown to guests on its page.
 */
export function getResponseStats(businessId: string, since: Date) {
  return stats.responseStats(prisma, businessId, since);
}

/** Every confirmed direct booking since the place joined, by currency. */
export function getLifetimeDirectRevenue(businessId: string) {
  return stats.lifetimeDirectRevenue(prisma, businessId);
}

/** Today at a glance for several places: requests waiting, arrivals, departures, guests in, this month's revenue. */
export function getPlaceSnapshots(businessIds: readonly string[], today: Date, month: DateRange) {
  return stats.placeSnapshots(prisma, businessIds, today, month);
}
