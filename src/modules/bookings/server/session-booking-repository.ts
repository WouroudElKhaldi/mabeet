import type { BookingMode, BookingStatus } from "@prisma/client";
import { ACTIVE_BOOKING_STATUSES, EXPIRING_BOOKING_STATUSES } from "@/config/enums";
import type { Db, Tx } from "@/server/db/client";

// Seats in the sessions of experiences and services. The session_seats_guard trigger refuses any write that would
// seat more guests than a session has, whatever the code does; the service locks the session first, so guests racing
// for the last seats take turns.

interface NewSessionBooking {
  businessId: string;
  offeringId: string;
  sessionId: string;
  guestUserId: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  guestNote: string | null;
  seats: number;
  totalCents: number;
  currency: string;
  reference: string;
  publicToken: string;
  /** Copied from the business, so a later change of mode never changes this booking. */
  bookingMode: BookingMode;
  /** HELD or AWAITING_PAYMENT: both take the seats. */
  status: BookingStatus;
  holdExpiresAt: Date | null;
  /** The guest's language, for their emails. */
  locale: string;
}

/** Takes the seats. The trigger refuses seats the session no longer has (23P01). */
export function createSessionBooking(tx: Tx, booking: NewSessionBooking) {
  return tx.sessionBooking.create({ data: booking });
}

/**
 * Expires seat bookings nobody paid or the owner never answered, which gives their seats back. One UPDATE that
 * re-checks the status, so a booking confirmed or paid a moment earlier is never touched. `sessionId` limits it to
 * one session.
 */
export function expireStaleSessionHolds(tx: Tx, now: Date, sessionId?: string) {
  return tx.sessionBooking.updateManyAndReturn({
    where: {
      status: { in: [...EXPIRING_BOOKING_STATUSES] },
      holdExpiresAt: { lt: now },
      isDeleted: false,
      ...(sessionId && { sessionId }),
    },
    data: { status: "EXPIRED" },
    select: { id: true, businessId: true, sessionId: true, guestUserId: true },
  });
}

/** Whether anyone still holds seats in the session: waiting for payment, for the owner, or confirmed. */
export async function hasSeatedGuests(tx: Tx, businessId: string, sessionId: string): Promise<boolean> {
  const count = await tx.sessionBooking.count({
    where: { businessId, sessionId, status: { in: [...ACTIVE_BOOKING_STATUSES] }, isDeleted: false },
  });
  return count > 0;
}

const staffFields = {
  offering: { select: { id: true, title: true, kind: true } },
  session: { select: { id: true, startsAt: true, endsAt: true } },
} as const;

export function findSessionBooking(db: Db, businessId: string, bookingId: string) {
  return db.sessionBooking.findFirst({
    where: { id: bookingId, businessId, isDeleted: false },
    include: staffFields,
  });
}

/** Seats by their private link, only for the guest who booked them: anyone else gets nothing. */
export function findSessionBookingByPublicToken(db: Db, publicToken: string, guestUserId: string) {
  return db.sessionBooking.findFirst({
    where: { publicToken, guestUserId, isDeleted: false },
    include: {
      offering: { select: { id: true, slug: true, title: true, kind: true, meetingPoint: true } },
      session: { select: { id: true, startsAt: true, endsAt: true } },
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

export interface SessionBookingFilters {
  status?: BookingStatus;
  /** Sessions that start at or after this moment, or before it. */
  startsFrom?: Date;
  startsBefore?: Date;
  take: number;
  skip: number;
}

/** The business's seat bookings, by when their session starts. */
export function listSessionBookings(db: Db, businessId: string, filters: SessionBookingFilters) {
  return db.sessionBooking.findMany({
    where: {
      businessId,
      isDeleted: false,
      status: filters.status,
      session: { startsAt: { gte: filters.startsFrom, lt: filters.startsBefore } },
    },
    orderBy: { session: { startsAt: "asc" } },
    take: filters.take,
    skip: filters.skip,
    include: staffFields,
  });
}

/** The guest's own seat bookings, the latest session first. */
export function listGuestSessionBookings(db: Db, guestUserId: string) {
  return db.sessionBooking.findMany({
    where: { guestUserId, isDeleted: false },
    orderBy: { session: { startsAt: "desc" } },
    include: {
      offering: { select: { title: true, slug: true, kind: true } },
      session: { select: { startsAt: true } },
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
 * Moves seats from the status they were read in to a new one. Null when they were no longer in it: the clock or the
 * guest changed it a moment earlier, and that change stands.
 */
export async function changeSessionStatus(
  tx: Tx,
  businessId: string,
  bookingId: string,
  from: BookingStatus,
  change: StatusChange,
) {
  const { count } = await tx.sessionBooking.updateMany({
    where: { id: bookingId, businessId, status: from, isDeleted: false },
    data: change,
  });
  if (count === 0) return null;
  return tx.sessionBooking.findFirstOrThrow({ where: { id: bookingId, businessId }, include: staffFields });
}

/** What a booking email about seats needs, read fresh by the notify job. */
export function findSessionBookingForNotice(db: Db, bookingId: string) {
  return db.sessionBooking.findFirst({
    where: { id: bookingId, isDeleted: false },
    include: {
      offering: { select: { title: true } },
      session: { select: { startsAt: true } },
      guestUser: { select: { email: true, isDeleted: true } },
      business: { select: { id: true, name: true, timezone: true, paymentInstructions: true } },
      // Paid online, whether or not it has been refunded since: the emails say what happened to the money.
      payments: { where: { status: { in: ["PAID", "REFUNDED"] }, isDeleted: false }, select: { id: true } },
    },
  });
}

/**
 * Seats held in each of these sessions now: confirmed, or waiting for the payment or the owner while their time has
 * not run out. A hold past its time gives its seats back at the next booking, so it is not counted here either.
 */
export function countSeatsTaken(db: Db, sessionIds: readonly string[], now: Date) {
  return db.sessionBooking.groupBy({
    by: ["sessionId"],
    where: {
      sessionId: { in: [...sessionIds] },
      isDeleted: false,
      OR: [
        { status: "CONFIRMED" },
        {
          status: { in: [...EXPIRING_BOOKING_STATUSES] },
          OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gte: now } }],
        },
      ],
    },
    _sum: { seats: true },
  });
}
