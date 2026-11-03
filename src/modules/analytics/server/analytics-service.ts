import { BOOKABLE_ROOM_KIND } from "@/config/booking-limits";
import type { AnalyticsScope } from "@/config/enums";
import { getPlanFeesPaid } from "@/modules/billing/server";
import {
  type ChannelNights,
  getLifetimeDirectRevenue,
  getPlaceSnapshots,
  getStayNumbers,
  type MonthlyNights,
} from "@/modules/bookings/server";
import { countActiveUnits } from "@/modules/rooms/server";
import { listWorkspaces } from "@/modules/team/server";
import { findPlacesForReports } from "@/modules/workspaces/server";
import { resolveContext } from "@/server/auth/resolve-context";
import { can, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { notFound } from "@/server/errors";
import { countNights, type DateRange, toIsoDate, todayUtc } from "@/utils/dates";

// One reporting layer for the dashboard, the host's AI app and (later) our own assistant, so their numbers always
// match. Every number comes from the database; money is added up per currency, never mixed.

export interface BusinessReport {
  range: { from: string; to: string };
  currency: string;
  /** Sold nights out of the nights the place could sell, from 0 to 1. */
  occupancyRate: number;
  nightsSold: number;
  nightsAvailable: number;
  directRevenueCents: number;
  /** Direct revenue for each direct night sold, or null with none. */
  averageDailyRateCents: number | null;
  /** What Airbnb or Booking.com would have taken of the direct revenue, at the place's own rate. */
  commissionSavedCents: number;
  channels: ChannelNights[];
  monthly: MonthlyNights[];
  /** Requests made in the period, by what became of them. */
  requests: Record<string, number>;
  medianResponseMinutes: number | null;
}

async function placeFor(businessId: string) {
  const [place] = await findPlacesForReports([businessId]);
  if (!place) throw notFound("Place");
  return place;
}

/** A place's numbers over a period. */
export async function getBusinessReport(ctx: TenantContext, range: DateRange): Promise<BusinessReport> {
  requirePermission(ctx, "analytics.read");
  const place = await placeFor(ctx.businessId);
  const kind = BOOKABLE_ROOM_KIND[place.bookingUnit];
  const [numbers, units] = await Promise.all([
    getStayNumbers(ctx.businessId, kind, range),
    countActiveUnits(ctx.businessId, kind),
  ]);
  const nightsSold = numbers.channels.reduce((sum, channel) => sum + channel.nights, 0);
  const nightsAvailable = units * countNights(range);
  const directNights = numbers.channels.find((channel) => channel.channel === "DIRECT")?.nights ?? 0;
  return {
    range: { from: toIsoDate(range.checkIn), to: toIsoDate(range.checkOut) },
    currency: place.currency,
    occupancyRate: nightsAvailable === 0 ? 0 : Math.min(1, nightsSold / nightsAvailable),
    nightsSold,
    nightsAvailable,
    directRevenueCents: numbers.directRevenueCents,
    averageDailyRateCents: directNights === 0 ? null : Math.round(numbers.directRevenueCents / directNights),
    commissionSavedCents: Math.round((numbers.directRevenueCents * place.commissionRateBps) / 10_000),
    channels: numbers.channels,
    monthly: numbers.monthly,
    requests: numbers.requests,
    medianResponseMinutes: numbers.medianResponseMinutes,
  };
}

interface Savings {
  currency: string;
  /** Every confirmed direct booking since the place joined. */
  directRevenueCents: number;
  /** What Airbnb or Booking.com would have taken from it, at the place's own rate. */
  commissionSavedCents: number;
}

/**
 * Since the place joined: what booking direct saved it, per currency, and what it paid Mabeet for plans. The
 * difference is what it kept.
 */
export async function getSavings(ctx: TenantContext) {
  requirePermission(ctx, "analytics.read");
  const [place, revenue, planFees] = await Promise.all([
    placeFor(ctx.businessId),
    getLifetimeDirectRevenue(ctx.businessId),
    getPlanFeesPaid(ctx.businessId),
  ]);
  const rows = revenue.length > 0 ? revenue : [{ currency: place.currency, cents: 0 }];
  const savings: Savings[] = rows.map((row) => ({
    currency: row.currency,
    directRevenueCents: row.cents,
    commissionSavedCents: Math.round((row.cents * place.commissionRateBps) / 10_000),
  }));
  return { savings, planFees };
}

/** The member in each of their places, where they may do `permission`. */
async function contextsWhere(userId: string, permission: "analytics.read" | "bookings.read") {
  const memberships = await listWorkspaces(userId);
  const contexts = await Promise.all(
    memberships.map((membership) => resolveContext(userId, membership.businessId)),
  );
  return {
    memberships,
    allowed: contexts.filter((ctx): ctx is TenantContext => ctx !== null && can(ctx, permission)),
  };
}

/**
 * Every place of the person side by side: requests waiting, today's arrivals and departures, guests in, and this
 * month's direct revenue. Numbers only where they may read bookings; the other places are listed without them.
 */
export async function getPlacesOverview(userId: string, today = todayUtc()) {
  const { memberships, allowed } = await contextsWhere(userId, "bookings.read");
  const ids = allowed.map((ctx) => ctx.businessId);
  const month = {
    checkIn: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
    checkOut: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)),
  };
  const [snapshots, places] = await Promise.all([
    getPlaceSnapshots(ids, today, month),
    findPlacesForReports(memberships.map((membership) => membership.businessId)),
  ]);
  const snapshotOf = new Map(snapshots.map((row) => [row.businessId, row]));
  const placeOf = new Map(places.map((place) => [place.id, place]));
  const readable = new Set(ids);
  return memberships
    .filter((membership) => placeOf.has(membership.businessId))
    .map((membership) => ({
      id: membership.businessId,
      name: membership.business.name,
      slug: membership.business.slug,
      role: membership.role.name,
      currency: placeOf.get(membership.businessId)?.currency ?? "USD",
      stats: readable.has(membership.businessId)
        ? (snapshotOf.get(membership.businessId) ?? {
            waiting: 0,
            arrivingToday: 0,
            leavingToday: 0,
            inHouse: 0,
            monthRevenueCents: 0,
          })
        : null,
    }));
}

interface PlaceAnalytics {
  businessId: string;
  name: string;
  report: BusinessReport;
}

/** Adds up values that share a key (a currency, a month, a channel, a status). */
function sumBy(rows: Array<{ key: string; value: number }>): Array<[string, number]> {
  const sums = new Map<string, number>();
  for (const row of rows) sums.set(row.key, (sums.get(row.key) ?? 0) + row.value);
  return [...sums];
}

const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

/** Several places' reports as one: nights add up, money adds up per currency and is never mixed. */
function combine(reports: BusinessReport[]) {
  const nightsSold = total(reports.map((report) => report.nightsSold));
  const nightsAvailable = total(reports.map((report) => report.nightsAvailable));
  return {
    nightsSold,
    nightsAvailable,
    occupancyRate: nightsAvailable === 0 ? 0 : Math.min(1, nightsSold / nightsAvailable),
    revenue: sumBy(reports.map((report) => ({ key: report.currency, value: report.directRevenueCents })))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, cents]) => ({ currency, cents })),
    commissionSaved: sumBy(
      reports.map((report) => ({ key: report.currency, value: report.commissionSavedCents })),
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, cents]) => ({ currency, cents })),
    requests: Object.fromEntries(
      sumBy(
        reports.flatMap((report) =>
          Object.entries(report.requests).map(([status, count]) => ({ key: status, value: count })),
        ),
      ),
    ),
    nightsByMonth: sumBy(
      reports.flatMap((report) => report.monthly.map((row) => ({ key: row.month, value: row.nights }))),
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, nights]) => ({ month, nights })),
    channels: sumBy(
      reports.flatMap((report) => report.channels.map((row) => ({ key: row.channel, value: row.nights }))),
    )
      .map(([channel, nights]) => ({ channel, nights }))
      .sort((a, b) => b.nights - a.nights),
  };
}

/**
 * Analytics for the place on screen, or for every place where the person may read the numbers, over a period, with
 * the places' totals.
 */
export async function getAnalytics(ctx: TenantContext, scope: AnalyticsScope, range: DateRange) {
  requirePermission(ctx, "analytics.read");
  const contexts =
    scope === "place" || ctx.platformAdmin
      ? [ctx]
      : (await contextsWhere(ctx.userId, "analytics.read")).allowed;
  const places = await findPlacesForReports(contexts.map((member) => member.businessId));
  const nameOf = new Map(places.map((place) => [place.id, place.name]));
  const reports: PlaceAnalytics[] = await Promise.all(
    contexts.map(async (member) => ({
      businessId: member.businessId,
      name: nameOf.get(member.businessId) ?? "",
      report: await getBusinessReport(member, range),
    })),
  );
  return {
    range: { from: toIsoDate(range.checkIn), to: toIsoDate(range.checkOut) },
    places: reports,
    totals: combine(reports.map((place) => place.report)),
  };
}
