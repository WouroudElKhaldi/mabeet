import { Prisma, type RoomKind } from "@prisma/client";
import { type Db, moneyNumber } from "@/server/db/client";
import type { DateRange } from "@/utils/dates";

// The numbers analytics reads from the night rows and the bookings, in raw SQL. Every query takes the business as a
// parameter. A night counts as sold when it is a confirmed direct booking, closed by the host or imported from a
// platform, on a unit of the kind the place is booked by (its rooms, or its whole-place unit), so a place never
// counts the same night twice.

const SOLD_NIGHT = Prisma.sql`o.active AND o."isDeleted" = false AND (o.kind <> 'DIRECT' OR b.status = 'CONFIRMED')`;

/** Where a sold night came from: our own booking, the host closing it, or the platform it was imported from. */
type Channel = "DIRECT" | "MANUAL" | "AIRBNB" | "BOOKING" | "OTHER";

export interface ChannelNights {
  channel: Channel;
  nights: number;
}

export function soldNightsByChannel(db: Db, businessId: string, kind: RoomKind, range: DateRange) {
  return db.$queryRaw<ChannelNights[]>`
    SELECT CASE
             WHEN o.kind = 'DIRECT' THEN 'DIRECT'
             WHEN o.kind = 'IMPORTED' THEN COALESCE(f.source::text, 'OTHER')
             ELSE 'MANUAL'
           END AS channel,
           SUM(LEAST(o."checkOut", ${range.checkOut}::date) - GREATEST(o."checkIn", ${range.checkIn}::date))::int AS nights
    FROM "Occupancy" o
    JOIN "Room" r ON r.id = o."roomId" AND r.kind = ${kind}::"RoomKind"
    LEFT JOIN "Booking" b ON b.id = o."bookingId"
    LEFT JOIN "CalendarFeed" f ON f.id = o."feedId"
    WHERE o."businessId" = ${businessId}
      AND o."checkIn" < ${range.checkOut}::date AND o."checkOut" > ${range.checkIn}::date
      AND ${SOLD_NIGHT}
    GROUP BY 1
    ORDER BY 2 DESC`;
}

export interface MonthlyNights {
  /** YYYY-MM */
  month: string;
  nights: number;
}

export function soldNightsByMonth(db: Db, businessId: string, kind: RoomKind, range: DateRange) {
  return db.$queryRaw<MonthlyNights[]>`
    SELECT to_char(night, 'YYYY-MM') AS month, COUNT(*)::int AS nights
    FROM "Occupancy" o
    JOIN "Room" r ON r.id = o."roomId" AND r.kind = ${kind}::"RoomKind"
    LEFT JOIN "Booking" b ON b.id = o."bookingId"
    CROSS JOIN LATERAL generate_series(
      GREATEST(o."checkIn", ${range.checkIn}::date),
      LEAST(o."checkOut", ${range.checkOut}::date) - 1,
      interval '1 day'
    ) AS night
    WHERE o."businessId" = ${businessId}
      AND o."checkIn" < ${range.checkOut}::date AND o."checkOut" > ${range.checkIn}::date
      AND ${SOLD_NIGHT}
    GROUP BY 1
    ORDER BY 1`;
}

/** Confirmed direct revenue, counted for the nights of each stay that fall inside the range. */
export async function directRevenueCents(db: Db, businessId: string, range: DateRange): Promise<number> {
  const [row] = await db.$queryRaw<Array<{ cents: bigint | null }>>`
    SELECT SUM(
             b."totalCents"::numeric
             * (LEAST(b."checkOut", ${range.checkOut}::date) - GREATEST(b."checkIn", ${range.checkIn}::date))
             / (b."checkOut" - b."checkIn")
           )::bigint AS cents
    FROM "Booking" b
    WHERE b."businessId" = ${businessId} AND b."isDeleted" = false AND b.status = 'CONFIRMED'
      AND b."checkIn" < ${range.checkOut}::date AND b."checkOut" > ${range.checkIn}::date`;
  return moneyNumber(row?.cents ?? 0);
}

export interface MonthlyRevenue {
  /** YYYY-MM */
  month: string;
  cents: number;
}

/** Confirmed direct revenue by the month stays begin, for the stays beginning in the range. */
export async function revenueByMonth(
  db: Db,
  businessId: string,
  range: DateRange,
): Promise<MonthlyRevenue[]> {
  const rows = await db.$queryRaw<Array<{ month: string; cents: bigint }>>`
    SELECT to_char("checkIn", 'YYYY-MM') AS month, SUM("totalCents")::bigint AS cents
    FROM "Booking"
    WHERE "businessId" = ${businessId} AND "isDeleted" = false AND status = 'CONFIRMED'
      AND "checkIn" >= ${range.checkIn}::date AND "checkIn" < ${range.checkOut}::date
    GROUP BY 1
    ORDER BY 1`;
  return rows.map((row) => ({ month: row.month, cents: moneyNumber(row.cents) }));
}

/** Every confirmed direct booking since the place joined, by currency. */
export async function lifetimeDirectRevenue(db: Db, businessId: string) {
  const rows = await db.$queryRaw<Array<{ currency: string; cents: bigint }>>`
    SELECT currency, SUM("totalCents")::bigint AS cents
    FROM "Booking"
    WHERE "businessId" = ${businessId} AND "isDeleted" = false AND status = 'CONFIRMED'
    GROUP BY currency
    ORDER BY currency`;
  return rows.map((row) => ({ currency: row.currency, cents: moneyNumber(row.cents) }));
}

/** Requests made in the range, by what became of them. */
export function requestsByStatus(db: Db, businessId: string, range: DateRange) {
  return db.booking.groupBy({
    by: ["status"],
    where: { businessId, isDeleted: false, createdAt: { gte: range.checkIn, lt: range.checkOut } },
    _count: { _all: true },
  });
}

/** How long the host typically took to answer a request made in the range, in minutes, or null with none. */
export async function medianResponseMinutes(
  db: Db,
  businessId: string,
  range: DateRange,
): Promise<number | null> {
  const [row] = await db.$queryRaw<Array<{ minutes: number | null }>>`
    SELECT (percentile_cont(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM ("decidedAt" - "createdAt")) / 60
           ))::int AS minutes
    FROM "Booking"
    WHERE "businessId" = ${businessId} AND "isDeleted" = false AND "decidedAt" IS NOT NULL
      AND "createdAt" >= ${range.checkIn} AND "createdAt" < ${range.checkOut}`;
  return row?.minutes ?? null;
}

export interface PlaceSnapshot {
  businessId: string;
  /** Requests waiting for the host's answer. */
  waiting: number;
  arrivingToday: number;
  leavingToday: number;
  /** Guests staying tonight. */
  inHouse: number;
  /** Confirmed direct revenue of the stays starting this month. */
  monthRevenueCents: number;
}

/** Today at a glance for several places at once, for the owner's "All my places". */
export async function placeSnapshots(
  db: Db,
  businessIds: readonly string[],
  today: Date,
  month: DateRange,
): Promise<PlaceSnapshot[]> {
  if (businessIds.length === 0) return [];
  const rows = await db.$queryRaw<
    Array<Omit<PlaceSnapshot, "monthRevenueCents"> & { monthRevenueCents: bigint }>
  >`
    SELECT b."businessId",
           COUNT(*) FILTER (WHERE b.status = 'HELD')::int AS waiting,
           COUNT(*) FILTER (WHERE b.status = 'CONFIRMED' AND b."checkIn" = ${today}::date)::int AS "arrivingToday",
           COUNT(*) FILTER (WHERE b.status = 'CONFIRMED' AND b."checkOut" = ${today}::date)::int AS "leavingToday",
           COUNT(*) FILTER (
             WHERE b.status = 'CONFIRMED' AND b."checkIn" <= ${today}::date AND b."checkOut" > ${today}::date
           )::int AS "inHouse",
           COALESCE(SUM(b."totalCents") FILTER (
             WHERE b.status = 'CONFIRMED' AND b."checkIn" >= ${month.checkIn}::date AND b."checkIn" < ${month.checkOut}::date
           ), 0)::bigint AS "monthRevenueCents"
    FROM "Booking" b
    WHERE b."businessId" IN (${Prisma.join([...businessIds])}) AND b."isDeleted" = false
    GROUP BY b."businessId"`;
  return rows.map((row) => ({ ...row, monthRevenueCents: moneyNumber(row.monthRevenueCents) }));
}

export interface ResponseStats {
  /** Requests that waited for the host's answer: offline requests, and requests paid for in mode 2. */
  requests: number;
  /** Of those, the ones the host confirmed or declined before they expired. */
  answered: number;
  /** How long the host typically took to answer, in minutes, or null when they answered none. */
  medianMinutes: number | null;
}

/**
 * How the host answers requests made since `since`, for guests deciding whether to book. Only requests that really
 * waited for the host count: an automatic booking never asks them, and in mode 2 a booking whose payment never came
 * never reached them. A request counts as answered when it ends confirmed or declined by a person, and as missed
 * when it expired waiting; one cancelled meanwhile counts as neither, since a later cancellation overwrites when it
 * was decided. The clock starts when the request reached the host: at once offline, at the payment in mode 2.
 */
export async function responseStats(db: Db, businessId: string, since: Date): Promise<ResponseStats> {
  const [row] = await db.$queryRaw<Array<ResponseStats>>`
    WITH waited AS (
      SELECT b.status, b."decidedAt",
             COALESCE(
               (SELECT MIN(p."paidAt") FROM "Payment" p WHERE p."bookingId" = b.id AND p."paidAt" IS NOT NULL),
               b."createdAt"
             ) AS "reachedAt"
      FROM "Booking" b
      WHERE b."businessId" = ${businessId} AND b."isDeleted" = false AND b."bookingMode" <> 'AUTOMATIC'
        AND b."createdAt" >= ${since}
        AND (
          (b.status IN ('CONFIRMED', 'DECLINED') AND b."decidedById" IS NOT NULL)
          OR (
            b.status = 'EXPIRED'
            AND (
              b."bookingMode" = 'OFFLINE'
              OR EXISTS (SELECT 1 FROM "Payment" p WHERE p."bookingId" = b.id AND p."paidAt" IS NOT NULL)
            )
          )
        )
    )
    SELECT COUNT(*)::int AS requests,
           COUNT(*) FILTER (WHERE status <> 'EXPIRED')::int AS answered,
           (percentile_cont(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("decidedAt" - "reachedAt")) / 60
            ) FILTER (WHERE status <> 'EXPIRED'))::int AS "medianMinutes"
    FROM waited`;
  return row ?? { requests: 0, answered: 0, medianMinutes: null };
}
