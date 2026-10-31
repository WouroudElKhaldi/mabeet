import type { BookingMode, BookingStatus, FeedSource, PhotoArea } from "@prisma/client";

// Value lists shared by validation, the AI tools and the screens. `satisfies` checks them against the
// database enums, so adding a status in the schema cannot silently miss a list here.

export const BOOKING_STATUSES = [
  "HELD",
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const satisfies readonly BookingStatus[];

/** Statuses that hold the nights or seats: a request waiting, a payment due, or confirmed. */
export const ACTIVE_BOOKING_STATUSES = [
  "HELD",
  "AWAITING_PAYMENT",
  "CONFIRMED",
] as const satisfies readonly BookingStatus[];

/** Active statuses that end when their time runs out: a request nobody answered, a payment nobody made. */
export const EXPIRING_BOOKING_STATUSES = [
  "HELD",
  "AWAITING_PAYMENT",
] as const satisfies readonly BookingStatus[];

export const isActiveBooking = (status: BookingStatus): boolean =>
  (ACTIVE_BOOKING_STATUSES as readonly BookingStatus[]).includes(status);

/**
 * How a place is booked: paid online and confirmed at once, paid online and confirmed by the owner, or confirmed
 * by the owner with the payment arranged directly between them and the guest.
 */
export const BOOKING_MODES = [
  "AUTOMATIC",
  "ONLINE_APPROVAL",
  "OFFLINE",
] as const satisfies readonly BookingMode[];

/** The modes where the guest pays the full amount online, so the owner must accept full refunds first. */
export const ONLINE_BOOKING_MODES = [
  "AUTOMATIC",
  "ONLINE_APPROVAL",
] as const satisfies readonly BookingMode[];

export const isOnlineMode = (mode: BookingMode): boolean =>
  (ONLINE_BOOKING_MODES as readonly BookingMode[]).includes(mode);

/** Calendars we read taken nights from. */
export const FEED_SOURCES = ["AIRBNB", "BOOKING", "OTHER"] as const satisfies readonly FeedSource[];

/** Parts of a place a photo can show, in the order the photo tour lists them. */
export const PHOTO_AREAS = [
  "LIVING_ROOM",
  "KITCHEN",
  "DINING",
  "BEDROOM",
  "BATHROOM",
  "EXTERIOR",
  "TERRACE",
  "GARDEN",
  "POOL",
  "VIEW",
  "OTHER",
] as const satisfies readonly PhotoArea[];
