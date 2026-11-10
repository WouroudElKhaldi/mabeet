import type { BookingStatus } from "@prisma/client";
import { isActiveBooking } from "@/config/enums";
import { notePerson, recordAction, recordPersonAndBusiness } from "@/modules/audit/server";
import {
  closeSession,
  findBookableOffering,
  findOpenSession,
  lockSession,
  priceSession,
} from "@/modules/offerings/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { overlapAsConflict } from "@/server/db/constraint-errors";
import { conflict, invalid, notFound } from "@/server/errors";
import { bookingReference, secureToken } from "@/utils/tokens";
import { notifyBookingRequested, notifyBookingStatus, notifyGuestCancelled } from "./booking-notifications";
import { refundPayments, type RefundToSend, sendRefunds } from "./booking-payments";
import { initialStatus, sessionDayHasCome, sessionHoldUntil } from "./booking-policy";
import { cancelStayAsGuest, endExpired, presentForStaff } from "./booking-service";
import { assertOwnerCanAnswer, assertTransition } from "./booking-status";
import * as sessionBookings from "./session-booking-repository";

// Seats in a session of an experience or service. The same engine as a stay: the seats are taken at once, the
// business's mode decides what happens next (booking-policy.ts), the same statuses and full refunds. The session row
// is locked first by every change to who sits in it, and the session_seats_guard trigger refuses seats it no longer
// has, so when guests race for the last seats exactly the ones that fit get them.

const SEATS_TAKEN = "Those seats were just taken. Please pick another time.";
const JUST_CHANGED = "This booking just changed. Refresh to see where it stands.";
const SESSION_STARTED = "This session has already started.";
// Money for a session is released to the host from its day on (as a stay's from check-in), so from then on it is
// kept, like a stay that has started.
const SESSION_DAY = "This session is today or already past, so it can no longer be cancelled.";

interface SessionBookingRequest {
  offeringSlug: string;
  sessionId: string;
  seats: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  guestNote: string | null;
  /** The signed-in guest: booking needs an account. */
  guestUserId: string;
  /** The language the guest is browsing in; their emails use it. */
  locale?: string;
}

/**
 * A guest asks for seats. They are taken now: in the online modes they wait 10 minutes for the payment, offline they
 * wait for the owner's answer, and never past the moment the session starts.
 */
export async function requestSessionBooking(request: SessionBookingRequest, now = new Date()) {
  const { offeringSlug, sessionId, locale, ...guest } = request;
  const offering = await findBookableOffering(offeringSlug);
  if (!offering) throw notFound("Experience");
  if (request.seats > offering.maxGuests) {
    throw invalid(`Up to ${offering.maxGuests} guests can book together`);
  }
  const { business } = offering;

  let expired: Awaited<ReturnType<typeof sessionBookings.expireStaleSessionHolds>> = [];
  let refunds: RefundToSend[] = [];
  const booking = await overlapAsConflict(SEATS_TAKEN, () =>
    runInTransaction(async (tx) => {
      if (!(await lockSession(tx, business.id, sessionId))) throw notFound("Session");
      const session = await findOpenSession(offering.id, sessionId, now, tx);
      if (!session) throw notFound("Session");
      // Holds that ran out give their seats back now, even if housekeeping has not got to them yet.
      expired = await sessionBookings.expireStaleSessionHolds(tx, now, session.id);
      const status = initialStatus(business.bookingMode);
      const created = await sessionBookings.createSessionBooking(tx, {
        ...guest,
        businessId: business.id,
        offeringId: offering.id,
        sessionId: session.id,
        totalCents: priceSession(offering, request.seats),
        currency: business.currency,
        reference: bookingReference(),
        publicToken: secureToken(),
        bookingMode: business.bookingMode,
        status,
        holdExpiresAt: sessionHoldUntil(status, business.holdHours, session.startsAt, now),
        locale: locale ?? "en",
      });
      // Same transaction: the guest never gets an error for a booking that was in fact made.
      await recordPersonAndBusiness(tx, {
        userId: request.guestUserId,
        businessId: business.id,
        action: "booking.requested",
        entity: "session_booking",
        entityId: created.id,
        note: { guest: created.guestName, reference: created.reference },
      });
      refunds = await endExpired(tx, expired, "session");
      return created;
    }),
  );
  // Offline, the owner answers now. Online, the guest pays first; the owner hears once the payment lands.
  if (booking.status === "HELD") notifyBookingRequested(booking.id, "session");
  else notifyBookingStatus(booking.id, "session");
  for (const ended of expired) notifyBookingStatus(ended.id, "session");
  await sendRefunds(refunds, now);
  return booking;
}

interface Decision {
  bookingId: string;
  reason?: string;
}

/** The owner confirms seats waiting for them (mode 2 once paid, mode 3). */
export function confirmSessionBooking(ctx: TenantContext, decision: Decision, now = new Date()) {
  return decide(ctx, decision, "CONFIRMED", now);
}

/** The owner turns seats down. They are free again at once. */
export function declineSessionBooking(ctx: TenantContext, decision: Decision, now = new Date()) {
  return decide(ctx, decision, "DECLINED", now);
}

/** The owner cancels seats, in any mode, before the session's day. */
export function cancelSessionBooking(ctx: TenantContext, decision: Decision, now = new Date()) {
  return decide(ctx, decision, "CANCELLED", now);
}

async function decide(ctx: TenantContext, { bookingId, reason }: Decision, status: BookingStatus, now: Date) {
  requirePermission(ctx, "bookings.decide");
  const { booking, refunds } = await runInTransaction(async (tx) => {
    const current = await sessionBookings.findSessionBooking(tx, ctx.businessId, bookingId);
    if (!current) throw notFound("Booking");
    await lockSession(tx, ctx.businessId, current.sessionId);
    if (status !== "CANCELLED") assertOwnerCanAnswer(current.status);
    assertTransition(current.status, status);
    if (current.session.startsAt <= now) throw conflict(SESSION_STARTED);
    if (status === "CANCELLED" && sessionDayHasCome(current.session.startsAt, now))
      throw conflict(SESSION_DAY);
    if (status === "CONFIRMED" && current.holdExpiresAt && current.holdExpiresAt <= now) {
      throw conflict("This request has run out. Ask the guest to book again.");
    }
    const updated = await sessionBookings.changeSessionStatus(tx, ctx.businessId, bookingId, current.status, {
      status,
      decidedById: ctx.userId,
      decidedAt: now,
      cancelReason: reason,
    });
    if (!updated) throw conflict(JUST_CHANGED);
    const action = `booking.${status.toLowerCase()}`;
    await recordAction(ctx, action, "session_booking", bookingId, tx, {
      guest: current.guestName,
      reference: current.reference,
    });
    await notePerson(tx, {
      userId: current.guestUserId,
      businessId: ctx.businessId,
      action,
      entity: "session_booking",
      entityId: bookingId,
    });
    // Declined or cancelled: whatever the guest paid online goes back in full, whoever ended it.
    const owed = isActiveBooking(status)
      ? []
      : await refundPayments(
          tx,
          { sessionBookingId: bookingId },
          status === "DECLINED" ? "Declined by the host" : "Cancelled by the host",
        );
    return { booking: updated, refunds: owed };
  });
  notifyBookingStatus(bookingId, "session");
  await sendRefunds(refunds, now);
  return presentForStaff(ctx, booking);
}

/** The business's seat bookings, by when their session starts, for the team that answers them. */
export async function listSessionBookings(
  ctx: TenantContext,
  filters: sessionBookings.SessionBookingFilters,
) {
  requirePermission(ctx, "bookings.read");
  const rows = await sessionBookings.listSessionBookings(prisma, ctx.businessId, filters);
  return rows.map((booking) => presentForStaff(ctx, booking));
}

/** The guest cancels their own seats from their private link, before the session's day. Null for anyone else's. */
async function cancelSeatsAsGuest(
  publicToken: string,
  guestUserId: string,
  reason: string | null,
  now: Date,
) {
  const result = await runInTransaction(async (tx) => {
    const current = await sessionBookings.findSessionBookingByPublicToken(tx, publicToken, guestUserId);
    if (!current) return null;
    await lockSession(tx, current.businessId, current.sessionId);
    assertTransition(current.status, "CANCELLED");
    if (sessionDayHasCome(current.session.startsAt, now)) throw conflict(SESSION_DAY);
    const updated = await sessionBookings.changeSessionStatus(
      tx,
      current.businessId,
      current.id,
      current.status,
      {
        status: "CANCELLED",
        cancelReason: reason ?? undefined,
      },
    );
    if (!updated) throw conflict(JUST_CHANGED);
    await recordPersonAndBusiness(tx, {
      userId: current.guestUserId,
      businessId: current.businessId,
      action: "booking.cancelled_by_guest",
      entity: "session_booking",
      entityId: current.id,
      note: { guest: current.guestName, reference: current.reference },
    });
    return {
      booking: updated,
      refunds: await refundPayments(tx, { sessionBookingId: current.id }, "Cancelled by the guest"),
    };
  });
  if (!result) return null;
  const { booking, refunds } = result;
  notifyBookingStatus(booking.id, "session");
  notifyGuestCancelled(booking.id, "session");
  await sendRefunds(refunds, now);
  return booking;
}

/**
 * The signed-in guest cancels their own booking from its private link, a stay or seats in a session. Null for an
 * unknown link or someone else's booking.
 */
export async function cancelBookingAsGuest(
  publicToken: string,
  guestUserId: string,
  reason: string | null,
  now = new Date(),
) {
  return (
    (await cancelStayAsGuest(publicToken, guestUserId, reason, now)) ??
    (await cancelSeatsAsGuest(publicToken, guestUserId, reason, now))
  );
}

/**
 * The team takes a session off the schedule. One with guests on it cannot vanish under them: their bookings are
 * declined or cancelled first, so each of them is told and refunded.
 */
export async function cancelSession(ctx: TenantContext, sessionId: string, now = new Date()) {
  requirePermission(ctx, "offerings.manage");
  const { expired, refunds } = await runInTransaction(async (tx) => {
    if (!(await lockSession(tx, ctx.businessId, sessionId))) throw notFound("Session");
    // Holds that already ran out are not guests on it any more.
    const ended = await sessionBookings.expireStaleSessionHolds(tx, now, sessionId);
    const owed = await endExpired(tx, ended, "session");
    if (await sessionBookings.hasSeatedGuests(tx, ctx.businessId, sessionId)) {
      throw conflict("Guests are booked on this session. Decline or cancel their bookings first.");
    }
    if (!(await closeSession(tx, ctx.businessId, sessionId))) throw notFound("Session");
    await recordAction(ctx, "session.cancelled", "session", sessionId, tx);
    return { expired: ended, refunds: owed };
  });
  for (const booking of expired) notifyBookingStatus(booking.id, "session");
  await sendRefunds(refunds, now);
}

/** The signed-in guest's seats in sessions, the latest session first. */
export function listMySessionBookings(guestUserId: string) {
  return sessionBookings.listGuestSessionBookings(prisma, guestUserId);
}

/** Housekeeping: expires every seat booking nobody paid in time or the owner never answered, and tells each guest. */
export async function expireAllStaleSessionHolds(now = new Date()) {
  const { expired, refunds } = await runInTransaction(async (tx) => {
    const rows = await sessionBookings.expireStaleSessionHolds(tx, now);
    return { expired: rows, refunds: await endExpired(tx, rows, "session") };
  });
  for (const booking of expired) notifyBookingStatus(booking.id, "session");
  await sendRefunds(refunds, now);
  return expired.length;
}
