import { z } from "zod";
import { BOOKING_MODES, CURRENCIES } from "@/config/enums";
import { ACCESSIBILITY, TAGS } from "@/config/listing";
import { REGION_KEYS } from "@/config/regions";
import { phone } from "@/lib/schemas";

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
 * `acceptOnlineTerms` once (the owner accepts that online payments are always refunded in full).
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
    tags: z.array(z.enum(TAGS)).max(12),
    accessibility: z.array(z.enum(ACCESSIBILITY)).max(6),
    minGuestAge: z.number().int().min(0).max(99).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .partial();
