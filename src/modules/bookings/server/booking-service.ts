import type { BookingStatus } from "@prisma/client";
import { isActiveBooking } from "@/config/enums";
import { notePerson, recordAction, recordPersonAndBusiness } from "@/modules/audit/server";
import { findRoomForBooking, hasWholePlaceUnit, priceStay } from "@/modules/rooms/server";
import { findBookablePlace } from "@/modules/workspaces/server";
import { can, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction, type Tx } from "@/server/db/client";
import { overlapAsConflict } from "@/server/db/constraint-errors";
import { conflict, invalid, notFound } from "@/server/errors";
import { countNights, type DateRange, todayUtc } from "@/utils/dates";
import { maskEmail, maskPhone } from "@/utils/privacy";
import { bookingReference, secureToken } from "@/utils/tokens";
import { notifyBookingRequested, notifyBookingStatus, notifyGuestCancelled } from "./booking-notifications";
import { refundPayments, type RefundToSend, sendRefunds } from "./booking-payments";
import { assertBookableStay, holdUntil, initialStatus } from "./booking-policy";
import * as bookings from "./booking-repository";
import { assertOwnerCanAnswer, assertTransition } from "./booking-status";
import { refreshBeforeBooking, refreshBeforeConfirming } from "./feed-sync-service";
import { recheckImportClashes } from "./import-clashes";

// The booking engine. A guest's request takes the room at once, so when two guests race for the last free night
// exactly one wins and the other hears it straight away. The business's mode decides what happens next
// (booking-policy.ts). Every change to a room's nights locks the room first, and every step of one change is one
// transaction: emails are queued, and platform clashes re-checked, only after it commits.

const DATES_TAKEN = "Those dates were just taken. Please pick other dates.";
const JUST_CHANGED = "This booking just changed. Refresh to see where it stands.";
const STAY_STARTED = "This stay has already started, so it can no longer be cancelled.";

/** The dates alone, before any lock is taken: the room's own limits are checked once it is loaded. */
function assertBookableRange(range: DateRange, now: Date): void {
  if (countNights(range) < 1) throw invalid("Check-out must be after check-in");
  assertBookableStay({ range, guests: null }, now);
}

interface BookingRequest {
  businessSlug: string;
  roomId: string;
  range: DateRange;
  guestCount: number;
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
 * A guest asks for dates. The room is held now, not when the owner confirms or the payment lands: in the online
 * modes it waits 10 minutes for the payment, offline it waits for the owner's answer.
 */
export async function requestBooking(request: BookingRequest, now = new Date()) {
  const { businessSlug, range, locale, ...stay } = request;
  assertBookableRange(range, now);
  const business = await findBookablePlace(businessSlug);
  if (!business) throw notFound("Place");
  // A stay booked on Airbnb or Booking.com a moment ago is read in first, so it refuses this request.
  await refreshBeforeBooking(business.id, request.roomId, now);

  let expired: Awaited<ReturnType<typeof bookings.expireStaleHolds>> = [];
  let refunds: RefundToSend[] = [];
  const booking = await overlapAsConflict(DATES_TAKEN, () =>
    runInTransaction(async (tx) => {
      // A place that can also be booked whole: its bookings take turns across all its units.
      const wholePlace = await hasWholePlaceUnit(business.id, tx);
      if (wholePlace) await bookings.lockBusinessForBooking(tx, business.id);
      if (!(await bookings.lockBookableRoom(tx, business.id, request.roomId))) throw notFound("Room");
      const room = await findRoomForBooking(business.id, request.roomId, tx);
      if (!room) throw notFound("Room");
      assertBookableStay({ range, guests: request.guestCount, room }, now);
      expired = await bookings.expireStaleHolds(tx, now, room.id);
      if (await bookings.findOverlappingImported(tx, business.id, room.id, range))
        throw conflict(DATES_TAKEN);
      if (wholePlace && (await bookings.findSiblingOverlap(tx, room, range, now)))
        throw conflict(DATES_TAKEN);

      const quote = await priceStay(room, range, tx);
      const status = initialStatus(business.bookingMode);
      const created = await bookings.createBooking(tx, {
        ...stay,
        range,
        businessId: business.id,
        roomId: room.id,
        totalCents: quote.totalCents,
        currency: business.currency,
        reference: bookingReference(),
        publicToken: secureToken(),
        bookingMode: business.bookingMode,
        status,
        holdExpiresAt: holdUntil(status, business.holdHours, now),
        locale: locale ?? "en",
      });
      // Same transaction: the guest never gets an error for a booking that was in fact made.
      await recordPersonAndBusiness(tx, {
        userId: request.guestUserId,
        businessId: business.id,
        action: "booking.requested",
        entity: "booking",
        entityId: created.id,
      });
      refunds = await endExpired(tx, expired);
      return created;
    }),
  );
  // Offline, the owner answers now. Online, the guest pays first; the owner hears once the payment lands.
  if (booking.status === "HELD") notifyBookingRequested(booking.id);
  else notifyBookingStatus(booking.id);
  for (const ended of expired) notifyBookingStatus(ended.id);
  await sendRefunds(refunds, now);
  if (expired.length > 0) await recheckImportClashes(business.id, booking.roomId, now);
  return booking;
}

interface Decision {
  bookingId: string;
  reason?: string;
}

/** The owner confirms a booking waiting for them (mode 2 once paid, mode 3). */
export function confirmBooking(ctx: TenantContext, decision: Decision, now = new Date()) {
  return decide(ctx, decision, "CONFIRMED", now);
}

/** The owner turns a waiting booking down. The nights are freed at once. */
export function declineBooking(ctx: TenantContext, decision: Decision, now = new Date()) {
  return decide(ctx, decision, "DECLINED", now);
}

/** The owner cancels a booking, in any mode. The nights are freed at once. */
export function cancelBooking(ctx: TenantContext, decision: Decision, now = new Date()) {
  return decide(ctx, decision, "CANCELLED", now);
}

async function decide(ctx: TenantContext, { bookingId, reason }: Decision, status: BookingStatus, now: Date) {
  requirePermission(ctx, "bookings.decide");
  if (status === "CONFIRMED") {
    // The platforms' calendars are read again first, so a stay sold there since the request stops this confirmation.
    const waiting = await bookings.findBooking(prisma, ctx.businessId, bookingId);
    if (!waiting) throw notFound("Booking");
    await refreshBeforeConfirming(ctx.businessId, waiting.roomId, now);
  }
  const { booking, refunds } = await runInTransaction(async (tx) => {
    const current = await bookings.findBooking(tx, ctx.businessId, bookingId);
    if (!current) throw notFound("Booking");
    await bookings.lockActiveRoom(tx, ctx.businessId, current.roomId);
    if (status !== "CANCELLED") assertOwnerCanAnswer(current.status);
    assertTransition(current.status, status);
    // A stay that has started can no longer end here: its money may already be paid out to the owner (payouts only
    // release stays that have started), so ending it could refund money we no longer hold.
    if (status === "CANCELLED" && current.checkIn <= todayUtc(now)) throw conflict(STAY_STARTED);
    if (status === "CONFIRMED") await assertStillConfirmable(tx, ctx.businessId, current, now);
    const updated = await bookings.changeStatus(tx, ctx.businessId, bookingId, current.status, {
      status,
      decidedById: ctx.userId,
      decidedAt: now,
      cancelReason: reason,
    });
    if (!updated) throw conflict(JUST_CHANGED);
    const action = `booking.${status.toLowerCase()}`;
    await recordAction(ctx, action, "booking", bookingId, tx);
    await notePerson(tx, {
      userId: current.guestUserId,
      businessId: ctx.businessId,
      action,
      entity: "booking",
      entityId: bookingId,
    });
    // Declined or cancelled: whatever the guest paid online goes back in full, whoever ended it.
    const owed = isActiveBooking(status)
      ? []
      : await refundPayments(
          tx,
          bookingId,
          status === "DECLINED" ? "Declined by the host" : "Cancelled by the host",
        );
    return { booking: updated, refunds: owed };
  });
  notifyBookingStatus(bookingId);
  await sendRefunds(refunds, now);
  if (!isActiveBooking(status)) await recheckImportClashes(ctx.businessId, booking.roomId, now);
  return presentForStaff(ctx, booking);
}

/** A hold whose time ran out cannot be confirmed, and nor can nights a platform has taken since the request. */
async function assertStillConfirmable(
  tx: Tx,
  businessId: string,
  booking: { roomId: string; checkIn: Date; checkOut: Date; holdExpiresAt: Date | null },
  now: Date,
) {
  if (booking.holdExpiresAt && booking.holdExpiresAt <= now) {
    throw conflict("This request has run out. Ask the guest to book again.");
  }
  if (await bookings.findOverlappingImported(tx, businessId, booking.roomId, booking)) {
    throw conflict(
      "Those nights were just taken on another platform. Decline this request or cancel the other stay.",
    );
  }
}

export async function getBooking(ctx: TenantContext, bookingId: string) {
  requirePermission(ctx, "bookings.read");
  const booking = await bookings.findBooking(prisma, ctx.businessId, bookingId);
  if (!booking) throw notFound("Booking");
  return presentForStaff(ctx, booking);
}

export async function listBookings(ctx: TenantContext, filters: bookings.BookingFilters) {
  requirePermission(ctx, "bookings.read");
  const rows = await bookings.listBookings(prisma, ctx.businessId, filters);
  return rows.map((booking) => presentForStaff(ctx, booking));
}

/** Hides the guest's phone and email from team members without the guests.contact permission. */
function presentForStaff<T extends { guestPhone: string; guestEmail: string | null }>(
  ctx: TenantContext,
  booking: T,
): T {
  if (can(ctx, "guests.contact")) return booking;
  return {
    ...booking,
    guestPhone: maskPhone(booking.guestPhone),
    guestEmail: booking.guestEmail && maskEmail(booking.guestEmail),
  };
}

/**
 * The signed-in guest cancels their own booking, from its private link: while it is held, waiting for payment or
 * confirmed, and before check-in. Null for an unknown link or someone else's booking.
 */
export async function cancelStayAsGuest(
  publicToken: string,
  guestUserId: string,
  reason: string | null,
  now = new Date(),
) {
  const result = await runInTransaction(async (tx) => {
    const current = await bookings.findBookingByPublicToken(tx, publicToken, guestUserId);
    if (!current) return null;
    await bookings.lockActiveRoom(tx, current.businessId, current.roomId);
    assertTransition(current.status, "CANCELLED");
    if (current.checkIn <= todayUtc(now)) throw conflict(STAY_STARTED);
    const updated = await bookings.changeStatus(tx, current.businessId, current.id, current.status, {
      status: "CANCELLED",
      cancelReason: reason ?? undefined,
    });
    if (!updated) throw conflict(JUST_CHANGED);
    await recordPersonAndBusiness(tx, {
      userId: current.guestUserId,
      businessId: current.businessId,
      action: "booking.cancelled_by_guest",
      entity: "booking",
      entityId: current.id,
    });
    return { booking: updated, refunds: await refundPayments(tx, current.id, "Cancelled by the guest") };
  });
  if (!result) return null;
  const { booking, refunds } = result;
  notifyBookingStatus(booking.id);
  notifyGuestCancelled(booking.id);
  await sendRefunds(refunds, now);
  await recheckImportClashes(booking.businessId, booking.roomId, now);
  return booking;
}

/** The guest's own booking by its private link, with its room, place and payments. Null for anyone else. */
export function getBookingForGuest(publicToken: string, guestUserId: string) {
  return bookings.findBookingByPublicToken(prisma, publicToken, guestUserId);
}

/** The signed-in guest's stays, newest first. */
export function listMyBookings(guestUserId: string) {
  return bookings.listGuestBookings(prisma, guestUserId);
}

/**
 * In the transaction that expired them: each hold that ran out goes on its guest's timeline, and a mode-2 booking
 * the owner never answered is refunded in full. Returns the refunds to send once it commits.
 */
async function endExpired(
  tx: Tx,
  expired: ReadonlyArray<{ id: string; businessId: string; guestUserId: string }>,
): Promise<RefundToSend[]> {
  const refunds: RefundToSend[] = [];
  for (const booking of expired) {
    await notePerson(tx, {
      userId: booking.guestUserId,
      businessId: booking.businessId,
      action: "booking.expired",
      entity: "booking",
      entityId: booking.id,
    });
    refunds.push(...(await refundPayments(tx, booking.id, "The host did not answer in time")));
  }
  return refunds;
}

/**
 * Housekeeping: expires every booking nobody paid in time or the owner never answered, tells each guest, and settles
 * platform clashes on the rooms it freed.
 */
export async function expireAllStaleHolds(now = new Date()) {
  const { expired, refunds } = await runInTransaction(async (tx) => {
    const rows = await bookings.expireStaleHolds(tx, now);
    return { expired: rows, refunds: await endExpired(tx, rows) };
  });
  for (const booking of expired) notifyBookingStatus(booking.id);
  await sendRefunds(refunds, now);
  const rooms = new Map(expired.map((booking) => [booking.roomId, booking.businessId]));
  for (const [roomId, businessId] of rooms) await recheckImportClashes(businessId, roomId, now);
  return expired.length;
}
