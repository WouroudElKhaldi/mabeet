import type {
  ActivityLevel,
  BookingMode,
  BookingStatus,
  BookingUnit,
  BusinessStatus,
  ListingKind,
  FeedSource,
  HostContact,
  PayoutMethod,
  PayoutStatus,
  PhotoArea,
  PriceUnit,
  SkillLevel,
} from "@prisma/client";

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

/** How a place is booked: room by room, or the whole place as one unit. */
export const BOOKING_UNITS = ["ROOMS", "WHOLE_PLACE"] as const satisfies readonly BookingUnit[];

/** The modes where the guest pays the full amount online, so the owner must accept full refunds first. */
export const ONLINE_BOOKING_MODES = [
  "AUTOMATIC",
  "ONLINE_APPROVAL",
] as const satisfies readonly BookingMode[];

export const isOnlineMode = (mode: BookingMode): boolean =>
  (ONLINE_BOOKING_MODES as readonly BookingMode[]).includes(mode);

/** The currencies a place can price in. Whish takes USD and LBP; cards take USD and EUR. */
export const CURRENCIES = ["USD", "LBP", "EUR"] as const;

/** How a guest pays online: with Whish, or by card (Stripe Checkout). */
export const ONLINE_PAYMENT_METHODS = ["WHISH", "CARD"] as const;
export type OnlinePaymentMethod = (typeof ONLINE_PAYMENT_METHODS)[number];

/** Where Mabeet sends a host's payout: a bank account (IBAN) or a Whish number. Never a card. */
export const PAYOUT_METHODS = ["BANK_TRANSFER", "WHISH"] as const satisfies readonly PayoutMethod[];

/** A payout the admin has decided: sent, or refused (then the host can ask again). */
export const DECIDED_PAYOUT_STATUSES = ["PAID", "REJECTED"] as const satisfies readonly PayoutStatus[];
export type DecidedPayoutStatus = (typeof DECIDED_PAYOUT_STATUSES)[number];

/** A business is live, or suspended by a platform admin (hidden everywhere until reactivated). */
export const BUSINESS_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
] as const satisfies readonly BusinessStatus[];

/** What the platform admin sets: suspend or reactivate. Archiving is the owner's own, from the place's settings. */
export const ADMIN_BUSINESS_STATUSES = ["ACTIVE", "SUSPENDED"] as const satisfies readonly BusinessStatus[];

/** Where the team can still work: an archived place is closed to guests, not to the people who run it. */
export const TEAM_OPEN_STATUSES = ["ACTIVE", "ARCHIVED"] as const satisfies readonly BusinessStatus[];

export const isTeamOpen = (status: BusinessStatus): boolean =>
  (TEAM_OPEN_STATUSES as readonly BusinessStatus[]).includes(status);

/** What a browse category is for: places, experiences or services. */
export const LISTING_KINDS = ["HOME", "EXPERIENCE", "SERVICE"] as const satisfies readonly ListingKind[];

/** Where an AI tool call came from: a host's own AI app (the host MCP), the dashboard chat, or the public guest MCP. */
export const AI_CALL_CHANNELS = ["mcp", "chat", "guest"] as const;
export type AiCallChannel = (typeof AI_CALL_CHANNELS)[number];

/** The periods the platform's AI usage page counts over, in days ending now. */
export const AI_USAGE_PERIODS = ["7", "30", "90"] as const;

/** What a host sells by the session rather than by the night. */
export const OFFERING_KINDS = ["EXPERIENCE", "SERVICE"] as const satisfies readonly ListingKind[];
export type OfferingKind = (typeof OFFERING_KINDS)[number];

/** A session's price is for each guest, or once for the whole group. */
export const PRICE_UNITS = ["PER_PERSON", "PER_GROUP"] as const satisfies readonly PriceUnit[];

/** How hard an experience is, and how much the guest needs to know already. */
export const ACTIVITY_LEVELS = [
  "LIGHT",
  "MODERATE",
  "CHALLENGING",
] as const satisfies readonly ActivityLevel[];
export const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const satisfies readonly SkillLevel[];

/** How guests may reach a host: WhatsApp and the Contact host page, or only one of them. */
export const HOST_CONTACT_OPTIONS = ["BOTH", "WHATSAPP", "MESSAGE"] as const satisfies readonly HostContact[];

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

/** Analytics for the place on screen, or for every place the member may read the numbers of. */
export type AnalyticsScope = "place" | "all";

/**
 * The kinds of people the admin's people table filters by: a platform admin, someone who owns a place (a host),
 * someone on a place's team who owns none, and everyone else (a guest).
 */
export const PERSON_KINDS = ["guest", "team", "host", "admin"] as const;
export type PersonKind = (typeof PERSON_KINDS)[number];
