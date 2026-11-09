import type { BookingMode, BookingStatus } from "@prisma/client";
import { EXPIRING_BOOKING_STATUSES, isActiveBooking } from "@/config/enums";
import type { Db, Tx } from "@/server/db/client";
import type { DateRange } from "@/utils/dates";

// Bookings and the nights they take. Every taken night is an Occupancy row: our bookings (DIRECT), closed dates
// (MANUAL) and platform stays (IMPORTED). The database's occupancy_no_overlap rule refuses two active DIRECT or
// MANUAL rows on one room night; imported rows are checked here, with the room locked.

/** Rows whose [checkIn, checkOut) range overlaps `range`. The check-out night is free, so touching stays don't. */
const overlapsRange = (range: DateRange) => ({
  checkIn: { lt: range.checkOut },
  checkOut: { gt: range.checkIn },
});

/**
 * A night row whose booking's time ran out but that housekeeping has not marked expired yet. Reads treat it as free
 * already, so a late worker never keeps a room blocked.
 */
const staleHold = (now: Date) => ({
  booking: { is: { status: { in: [...EXPIRING_BOOKING_STATUSES] }, holdExpiresAt: { lte: now } } },
});

// ---------- Locks ----------

/**
 * Takes a row lock on a live room for the rest of the transaction. Every change to the room's nights waits here
 * (decisions, cancellations, closed dates, clash checks), so checks against imported nights are race-free.
 */
export async function lockActiveRoom(tx: Tx, businessId: string, roomId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Room"
    WHERE id = ${roomId} AND "businessId" = ${businessId} AND active AND NOT "isDeleted"
    FOR UPDATE`;
  return rows.length > 0;
}

/**
 * Like lockActiveRoom, but only for a room guests can book right now: live, and of the kind the place books by
 * (its rooms, or the whole place as one unit).
 */
export async function lockBookableRoom(tx: Tx, businessId: string, roomId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT r.id FROM "Room" r
    JOIN "Business" b ON b.id = r."businessId"
    WHERE r.id = ${roomId} AND r."businessId" = ${businessId} AND r.active AND NOT r."isDeleted"
      AND ((b."bookingUnit" = 'ROOMS' AND r.kind = 'ROOM')
        OR (b."bookingUnit" = 'WHOLE_PLACE' AND r.kind = 'WHOLE_PLACE'))
    FOR UPDATE OF r`;
  return rows.length > 0;
}

/** Locks the business row: at a place that also books whole, new bookings take turns across all its units. */
export async function lockBusinessForBooking(tx: Tx, businessId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
}

// ---------- Bookings ----------

interface NewBooking {
  businessId: string;
  roomId: string;
  guestUserId: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  guestCount: number;
  guestNote: string | null;
  range: DateRange;
  totalCents: number;
  currency: string;
  reference: string;
  publicToken: string;
  /** Copied from the business, so a later change of mode never changes this booking. */
  bookingMode: BookingMode;
  /** HELD or AWAITING_PAYMENT: both take the nights. */
  status: BookingStatus;
  holdExpiresAt: Date | null;
  /** The guest's language, for their emails. */
  locale: string;
}

/** Inserts the booking and its DIRECT night row. The overlap rule refuses taken nights here. */
export function createBooking(tx: Tx, booking: NewBooking) {
  const { range, ...fields } = booking;
  return tx.booking.create({
    data: {
      ...fields,
      checkIn: range.checkIn,
      checkOut: range.checkOut,
      occupancy: {
        create: {
          businessId: booking.businessId,
          roomId: booking.roomId,
          checkIn: range.checkIn,
          checkOut: range.checkOut,
          kind: "DIRECT",
        },
      },
    },
  });
}

/**
 * Expires bookings nobody paid or the owner never answered, and frees their nights. One UPDATE that re-checks the
 * status, so a booking confirmed or paid a moment earlier is never touched. `roomId` limits it to one room.
 */
export async function expireStaleHolds(
  tx: Tx,
  now: Date,
  roomId?: string,
): Promise<Array<{ id: string; businessId: string; roomId: string; guestUserId: string }>> {
  const expired = await tx.booking.updateManyAndReturn({
    where: {
      status: { in: [...EXPIRING_BOOKING_STATUSES] },
      holdExpiresAt: { lt: now },
      isDeleted: false,
      ...(roomId && { roomId }),
    },
    data: { status: "EXPIRED" },
    select: { id: true, businessId: true, roomId: true, guestUserId: true },
  });
  if (expired.length === 0) return expired;
  await tx.occupancy.updateMany({
    where: { bookingId: { in: expired.map((booking) => booking.id) } },
    data: { active: false },
  });
  return expired;
}

/** A platform stay on these nights. Imported rows are outside the overlap rule, so this check holds the room lock. */
export function findOverlappingImported(db: Db, businessId: string, roomId: string, range: DateRange) {
  return db.occupancy.findFirst({
    where: { businessId, roomId, kind: "IMPORTED", active: true, isDeleted: false, ...overlapsRange(range) },
    select: { id: true },
  });
}

/**
 * Nights taken on the place's other units that clash with a stay: any room when booking the whole place, the
 * whole-place unit when booking a room. Only places that have a whole-place unit need this.
 */
export function findSiblingOverlap(
  db: Db,
  room: { id: string; businessId: string; kind: "ROOM" | "WHOLE_PLACE" },
  range: DateRange,
  now: Date,
) {
  return db.occupancy.findFirst({
    where: {
      businessId: room.businessId,
      roomId: { not: room.id },
      active: true,
      isDeleted: false,
      NOT: staleHold(now),
      ...(room.kind === "ROOM" && { room: { kind: "WHOLE_PLACE" } }),
      ...overlapsRange(range),
    },
    select: { id: true },
  });
}

// ---------- Public availability ----------

/** Night rows that take nights now: active, not deleted, and not a hold whose time already ran out. */
const takingNights = (range: DateRange, now: Date) => ({
  active: true,
  isDeleted: false,
  NOT: staleHold(now),
  ...overlapsRange(range),
});

/**
 * The stays that take a unit's nights in `range`: its own, and, at a place that also books whole (`acrossUnits`),
 * the units it takes turns with (the whole-place unit for a room; every room for the whole-place unit).
 */
export function listTakenStays(
  db: Db,
  unit: { id: string; businessId: string; kind: "ROOM" | "WHOLE_PLACE" },
  range: DateRange,
  now: Date,
  acrossUnits: boolean,
) {
  const siblings =
    unit.kind === "ROOM" ? { room: { kind: "WHOLE_PLACE" as const } } : { roomId: { not: unit.id } };
  return db.occupancy.findMany({
    where: {
      businessId: unit.businessId,
      ...takingNights(range, now),
      OR: acrossUnits ? [{ roomId: unit.id }, siblings] : [{ roomId: unit.id }],
    },
    select: { checkIn: true, checkOut: true },
  });
}

/** For search: every unit with a taken night in `range` at these places, with its kind, in one query. */
export function listTakenUnits(db: Db, businessIds: string[], range: DateRange, now: Date) {
  return db.occupancy.findMany({
    where: { businessId: { in: businessIds }, ...takingNights(range, now) },
    select: { roomId: true, businessId: true, room: { select: { kind: true } } },
    distinct: ["roomId"],
  });
}

const staffFields = { room: { select: { id: true, name: true } } } as const;

export function findBooking(db: Db, businessId: string, bookingId: string) {
  return db.booking.findFirst({
    where: { id: bookingId, businessId, isDeleted: false },
    include: staffFields,
  });
}

/** A booking by its private link, only for the guest who made it: anyone else gets nothing. */
export function findBookingByPublicToken(db: Db, publicToken: string, guestUserId: string) {
  return db.booking.findFirst({
    where: { publicToken, guestUserId, isDeleted: false },
    include: {
      room: { select: { id: true, name: true } },
      // Only what a guest may see of the place: never its plan, payment accounts or commission rate.
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          area: true,
          address: true,
          phone: true,
          whatsapp: true,
          timezone: true,
          checkInTime: true,
          checkOutTime: true,
          houseRules: true,
          paymentInstructions: true,
        },
      },
      payments: {
        where: { isDeleted: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, amountCents: true, currency: true, method: true, status: true, paidAt: true },
      },
    },
  });
}

export interface BookingFilters {
  status?: BookingStatus;
  roomId?: string;
  /** Stays still running on or after this night. */
  from?: Date;
  /** Stays starting before this night. */
  to?: Date;
  take: number;
  skip: number;
}

export function listBookings(db: Db, businessId: string, filters: BookingFilters) {
  return db.booking.findMany({
    where: {
      businessId,
      isDeleted: false,
      status: filters.status,
      roomId: filters.roomId,
      checkOut: filters.from && { gt: filters.from },
      checkIn: filters.to && { lt: filters.to },
    },
    orderBy: { checkIn: "asc" },
    take: filters.take,
    skip: filters.skip,
    include: staffFields,
  });
}

/** The guest's own stays, newest first, with where and what they booked. */
export function listGuestBookings(db: Db, guestUserId: string) {
  return db.booking.findMany({
    where: { guestUserId, isDeleted: false },
    orderBy: { checkIn: "desc" },
    include: {
      room: { select: { name: true } },
      business: { select: { name: true, slug: true } },
    },
  });
}

interface StatusChange {
  status: BookingStatus;
  /** The team member who decided, and when; absent when the guest or the clock changed the status. */
  decidedById?: string;
  decidedAt?: Date;
  cancelReason?: string;
  /** A new deadline: the owner's answer time once a mode-2 booking is paid, or none once it is confirmed. */
  holdExpiresAt?: Date | null;
}

/**
 * Moves a booking from the status it was read in to a new one, and keeps its night row's `active` flag in step.
 * Null when it was no longer in that status: the clock or the guest changed it a moment earlier, and that change
 * stands.
 */
export async function changeStatus(
  tx: Tx,
  businessId: string,
  bookingId: string,
  from: BookingStatus,
  change: StatusChange,
) {
  const { count } = await tx.booking.updateMany({
    where: { id: bookingId, businessId, status: from, isDeleted: false },
    data: change,
  });
  if (count === 0) return null;
  await tx.occupancy.updateMany({
    where: { bookingId, businessId },
    data: { active: isActiveBooking(change.status) },
  });
  return tx.booking.findFirstOrThrow({ where: { id: bookingId, businessId }, include: staffFields });
}

/** What a booking email needs, read fresh by the notify job. */
export function findBookingForNotice(db: Db, bookingId: string) {
  return db.booking.findFirst({
    where: { id: bookingId, isDeleted: false },
    include: {
      room: { select: { name: true } },
      guestUser: { select: { email: true, isDeleted: true } },
      business: { select: { id: true, name: true, timezone: true, paymentInstructions: true } },
      // Paid online, whether or not it has been refunded since: the emails say what happened to the money.
      payments: { where: { status: { in: ["PAID", "REFUNDED"] }, isDeleted: false }, select: { id: true } },
    },
  });
}

// ---------- The calendar and closed dates ----------

/** Every live taken night of the place in a range, from every source, for the dashboard calendar. */
export function listOccupancy(db: Db, businessId: string, range: DateRange, roomId?: string) {
  return db.occupancy.findMany({
    where: { businessId, roomId, active: true, isDeleted: false, ...overlapsRange(range) },
    orderBy: { checkIn: "asc" },
    select: {
      id: true,
      roomId: true,
      checkIn: true,
      checkOut: true,
      kind: true,
      note: true,
      conflict: true,
      booking: { select: { id: true, reference: true, status: true, guestName: true } },
      feed: { select: { source: true } },
    },
  });
}

/** Closes nights by hand. The overlap rule refuses nights already booked or closed. */
export function createManualBlock(
  db: Db,
  block: { businessId: string; roomId: string; range: DateRange; note: string | null },
) {
  return db.occupancy.create({
    data: {
      businessId: block.businessId,
      roomId: block.roomId,
      checkIn: block.range.checkIn,
      checkOut: block.range.checkOut,
      kind: "MANUAL",
      note: block.note,
    },
    select: { id: true, roomId: true, checkIn: true, checkOut: true, note: true },
  });
}

/** A live block's room, so the room can be locked before the block changes. */
export function findActiveBlock(db: Db, businessId: string, blockId: string) {
  return db.occupancy.findFirst({
    where: { id: blockId, businessId, kind: "MANUAL", active: true, isDeleted: false },
    select: { id: true, roomId: true },
  });
}

/** Reopens closed nights. Returns the room, or null when there was no such live block. */
export async function deactivateManualBlock(db: Db, businessId: string, blockId: string) {
  const [block] = await db.occupancy.updateManyAndReturn({
    where: { id: blockId, businessId, kind: "MANUAL", active: true, isDeleted: false },
    data: { active: false },
    select: { roomId: true },
  });
  return block?.roomId ?? null;
}

// ---------- Platform stays that clash with ours ----------

/** An imported stay whose clash flag just flipped; `conflict` is the new value. */
export interface ClashChange {
  id: string;
  checkIn: Date;
  checkOut: Date;
  conflict: boolean;
}

/**
 * Flags a room's imported nights that collide with our own live bookings or closed dates, and clears the flag once
 * they no longer do. Returns only the rows whose flag changed, so each clash is announced once. The caller holds
 * the room lock.
 */
export function flagImportClashes(tx: Tx, businessId: string, roomId: string) {
  return tx.$queryRaw<ClashChange[]>`
    UPDATE "Occupancy" AS imported
    SET conflict = clash.clashes
    FROM (
      SELECT candidate.id, candidate.active AND NOT candidate."isDeleted" AND EXISTS (
        SELECT 1 FROM "Occupancy" AS own
        WHERE own."businessId" = ${businessId} AND own."roomId" = ${roomId}
          AND own.active AND NOT own."isDeleted" AND own.kind <> 'IMPORTED'
          AND daterange(own."checkIn", own."checkOut", '[)')
            && daterange(candidate."checkIn", candidate."checkOut", '[)')
      ) AS clashes
      FROM "Occupancy" AS candidate
      WHERE candidate."businessId" = ${businessId} AND candidate."roomId" = ${roomId}
        AND candidate.kind = 'IMPORTED'
    ) AS clash
    WHERE imported.id = clash.id AND imported.conflict <> clash.clashes
    RETURNING imported.id, imported."checkIn", imported."checkOut", imported.conflict`;
}

/** A platform stay that clashes with our nights, and the bookings or closed dates it clashes with. */
export async function findImportClashForNotice(db: Db, occupancyId: string) {
  const imported = await db.occupancy.findFirst({
    where: { id: occupancyId, kind: "IMPORTED", isDeleted: false },
    select: {
      id: true,
      roomId: true,
      checkIn: true,
      checkOut: true,
      active: true,
      conflict: true,
      feed: { select: { source: true } },
      room: { select: { name: true } },
      business: { select: { id: true, name: true } },
    },
  });
  if (!imported) return null;
  const clashes = await db.occupancy.findMany({
    where: {
      roomId: imported.roomId,
      active: true,
      isDeleted: false,
      kind: { not: "IMPORTED" },
      ...overlapsRange(imported),
    },
    orderBy: { checkIn: "asc" },
    select: { note: true, booking: { select: { reference: true, guestName: true } } },
  });
  return { ...imported, clashes };
}

// ---------- Calendar sync: platform stays in, our nights out ----------

/**
 * Mirrors one calendar link's stays into IMPORTED night rows: each read is the whole picture, so a stay is saved by
 * its platform id (reading again never makes copies), and a stay that left the link (cancelled on the platform)
 * frees its nights. The caller holds the room lock.
 */
export async function replaceImportedStays(
  tx: Tx,
  feed: { id: string; businessId: string; roomId: string },
  stays: ReadonlyArray<DateRange & { uid: string }>,
) {
  for (const stay of stays) {
    await tx.occupancy.upsert({
      where: { feedId_externalUid: { feedId: feed.id, externalUid: stay.uid } },
      create: {
        businessId: feed.businessId,
        roomId: feed.roomId,
        feedId: feed.id,
        externalUid: stay.uid,
        kind: "IMPORTED",
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
      },
      update: { checkIn: stay.checkIn, checkOut: stay.checkOut, active: true, isDeleted: false },
    });
  }
  await tx.occupancy.updateMany({
    where: {
      businessId: feed.businessId,
      feedId: feed.id,
      active: true,
      externalUid: { notIn: stays.map((stay) => stay.uid) },
    },
    data: { active: false },
  });
}

/** A disconnected link's stays no longer block anything, and are no longer clashes. */
export function removeFeedStays(tx: Tx, businessId: string, feedId: string) {
  return tx.occupancy.updateMany({
    where: { businessId, feedId, isDeleted: false },
    data: { active: false, conflict: false, isDeleted: true },
  });
}

/** How many of a link's stays clash with our nights now. */
export function countFeedClashes(db: Db, businessId: string, feedId: string) {
  return db.occupancy.count({
    where: { businessId, feedId, kind: "IMPORTED", active: true, conflict: true, isDeleted: false },
  });
}

/**
 * The nights a room's calendar link shows as taken: our bookings (holds waiting for a payment or an answer included,
 * so a platform stops selling them at once) and closed dates, from today. At a place that also books whole
 * (`acrossUnits`), the units it takes turns with count too. Platform stays are never sent back out: that would make
 * Airbnb and Booking.com block each other in a loop.
 */
export function listExportNights(
  db: Db,
  unit: { id: string; businessId: string; kind: "ROOM" | "WHOLE_PLACE" },
  from: Date,
  now: Date,
  acrossUnits: boolean,
) {
  const siblings =
    unit.kind === "ROOM" ? { room: { kind: "WHOLE_PLACE" as const } } : { roomId: { not: unit.id } };
  return db.occupancy.findMany({
    where: {
      businessId: unit.businessId,
      kind: { not: "IMPORTED" },
      active: true,
      isDeleted: false,
      checkOut: { gt: from },
      NOT: staleHold(now),
      OR: acrossUnits ? [{ roomId: unit.id }, siblings] : [{ roomId: unit.id }],
    },
    orderBy: { checkIn: "asc" },
    select: { id: true, checkIn: true, checkOut: true },
  });
}
