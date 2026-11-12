import { z } from "zod";
import {
  ADMIN_BUSINESS_STATUSES,
  BOOKING_MODES,
  BUSINESS_STATUSES,
  CURRENCIES,
  HOST_CONTACT_OPTIONS,
} from "@/config/enums";
import { ACCESSIBILITY, LANGUAGES, TAGS } from "@/config/listing";
import { REGION_KEYS } from "@/config/regions";
import { PLANS } from "@/config/plans";
import { SETUP_SCREENS } from "@/config/setup";
import { id, listChoice, listQuery, phone } from "@/lib/schemas";

/** Creating a place: the person who creates it becomes its owner. */
export const workspaceInput = z.object({
  name: z.string().trim().min(2).max(80),
  area: z.string().trim().max(80).optional(),
  phone: phone.optional(),
});

/** Optional text the host can clear: an empty box is saved as nothing. */
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((text) => (text === "" ? null : text));

const clockTime = z.string().regex(/^\d{2}:\d{2}$/, "Use the 24-hour time, e.g. 14:00");

/**
 * A change to the place's settings: only the fields sent change. Choosing an online booking mode needs
 * `acceptOnlineTerms` once (the owner accepts that online payments are always refunded in full). `categories` are
 * the slugs of the admin's place categories, and replace the place's current ones.
 */
export const settingsInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: clearableText(4000),
    area: clearableText(80),
    region: z.enum(REGION_KEYS).nullable(),
    address: clearableText(200),
    phone: phone.nullable(),
    whatsapp: phone.nullable(),
    currency: z.enum(CURRENCIES),
    lbpRate: z.number().int().min(1).max(10_000_000).nullable(),
    commissionRateBps: z.number().int().min(0).max(5000),
    holdHours: z.number().int().min(1).max(168),
    paymentInstructions: clearableText(1000),
    checkInTime: clockTime,
    checkOutTime: clockTime,
    houseRules: clearableText(2000),
    bookingMode: z.enum(BOOKING_MODES),
    acceptOnlineTerms: z.boolean(),
    listedPublicly: z.boolean(),
    categories: z
      .array(z.string().trim().min(1).max(40))
      .max(6)
      .refine((list) => new Set(list).size === list.length, "List each category once"),
    tags: z.array(z.enum(TAGS)).max(12),
    accessibility: z.array(z.enum(ACCESSIBILITY)).max(6),
    minGuestAge: z.number().int().min(0).max(99).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .partial();

// ---------- Platform admin ----------

export const platformBusinessParams = z.object({ businessId: id });

/** A platform admin suspends a business, or brings it back. */
export const businessStatusInput = z.object({ status: z.enum(ADMIN_BUSINESS_STATUSES) });

/** The owner archives the place (closed to guests, kept for the team) or brings it back. */
export const placeArchiveInput = z.object({ archived: z.boolean() });

// ---------- Host profile ----------

/** Empty text is saved as nothing, so a cleared field goes back to its default (the account name, no city...). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

/** The owner's own host profile, shared by all their places. Never a phone or WhatsApp: guests use the business's. */
export const hostProfileInput = z.object({
  displayName: optionalText(80),
  bio: optionalText(1500),
  city: optionalText(80),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length),
  hostingSince: z.number().int().min(1950).max(2100).nullish(),
  showOnListings: z.boolean(),
  contactBy: z.enum(HOST_CONTACT_OPTIONS).default("BOTH"),
});

/** The admin's hosts table: words, and their places' status or plan. */
export const platformHostsQuery = listQuery.extend({
  status: listChoice(BUSINESS_STATUSES),
  plan: listChoice(PLANS),
});

/** The guided setup's screen in its address (`?step=photos`); the first one when it is missing or wrong. */
export const setupQuery = z.object({ step: z.enum(SETUP_SCREENS).catch("unit") });
