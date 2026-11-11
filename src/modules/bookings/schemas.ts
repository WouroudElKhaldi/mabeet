import { z } from "zod";
import { BOOKING_STATUSES, ONLINE_PAYMENT_METHODS } from "@/config/enums";
import { id, isoDate, phone, stayDates, workspaceParams } from "@/lib/schemas";
import { parseIsoDate, toDateRange } from "@/utils/dates";

// The booking engine's input checks. Each one hands the service its own shape: nights as a DateRange, dates as
// Date objects, missing text as null.

const night = isoDate.transform(parseIsoDate);

/** A place's public link, as in /api/public/places/{slug}/bookings. */
export const placeParams = z.object({ slug: z.string().trim().min(1).max(100) });

/** A guest asks for a stay. Who they are comes from their session, never from the body. */
export const bookingRequestInput = z
  .object({
    roomId: id,
    guestCount: z.number().int().min(1).max(30),
    guestName: z.string().trim().min(2).max(80),
    guestPhone: phone,
    guestEmail: z.email().max(254).nullish(),
    guestNote: z.string().trim().max(1000).nullish(),
  })
  .and(stayDates)
  .transform(({ checkIn, checkOut, guestEmail, guestNote, ...stay }) => ({
    ...stay,
    range: toDateRange({ checkIn, checkOut }),
    guestEmail: guestEmail ?? null,
    guestNote: guestNote ?? null,
  }));

/** An experience's or service's public link, as in /api/public/experiences/{slug}/bookings. */
export const experienceParams = z.object({ slug: z.string().trim().min(1).max(100) });

/** A guest asks for seats in one session. Who they are comes from their session, never from the body. */
export const sessionBookingRequestInput = z
  .object({
    sessionId: id,
    seats: z.number().int().min(1).max(100),
    guestName: z.string().trim().min(2).max(80),
    guestPhone: phone,
    guestEmail: z.email().max(254).nullish(),
    guestNote: z.string().trim().max(1000).nullish(),
  })
  .transform(({ guestEmail, guestNote, ...seats }) => ({
    ...seats,
    guestEmail: guestEmail ?? null,
    guestNote: guestNote ?? null,
  }));

/** The secret in a booking's private link, /b/{token}. */
export const bookingTokenParams = z.object({ token: z.string().min(20).max(64) });

/** The guest pays a booking that waits for its payment: with Whish, or by card. */
export const bookingCheckoutInput = z.object({ method: z.enum(ONLINE_PAYMENT_METHODS) });

export const guestCancelInput = z.object({ reason: z.string().trim().max(300).optional() });

export const bookingParams = workspaceParams.extend({ bookingId: id });

/**
 * The owner's three answers, about a stay (/api/workspaces/{businessId}/bookings/{bookingId}/{action}) or seats
 * (.../session-bookings/{bookingId}/{action}).
 */
export const bookingActionParams = bookingParams.extend({ action: z.enum(["confirm", "decline", "cancel"]) });

export const decisionInput = z.object({ reason: z.string().trim().max(500).optional() });

export const bookingFilters = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  roomId: id.optional(),
  from: night.optional(),
  to: night.optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

/** The team's list of seats booked in sessions, by when the session starts. */
export const sessionBookingFilters = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export const calendarQuery = z.object({
  from: night.optional(),
  to: night.optional(),
  roomId: id.optional(),
});

export const blockParams = workspaceParams.extend({ blockId: id });

/** Closing nights by hand: for maintenance, or a booking taken by phone. */
export const blockInput = z
  .object({ roomId: id, note: z.string().trim().max(200).nullish() })
  .and(stayDates)
  .transform(({ checkIn, checkOut, roomId, note }) => ({
    roomId,
    range: toDateRange({ checkIn, checkOut }),
    note: note ?? null,
  }));

/** A refund the admin sent by hand. */
export const refundParams = z.object({ refundId: id });
export const refundSentInput = z.object({ reference: z.string().trim().max(120).nullish() });
