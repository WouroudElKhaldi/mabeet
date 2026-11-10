import { z } from "zod";
import { ACTIVITY_LEVELS, OFFERING_KINDS, PRICE_UNITS, SKILL_LEVELS } from "@/config/enums";
import { ACCESSIBILITY, LANGUAGES, TAGS } from "@/config/listing";
import { REGION_KEYS } from "@/config/regions";
import { cents, id, isoDate, workspaceParams } from "@/lib/schemas";

// The input checks for experiences, services and their sessions. Booking seats in a session is the booking engine's
// (bookings/schemas.ts).

const listItems = z.array(z.string().trim().min(1).max(160)).max(12);

/** Optional text the host can clear: an empty box is saved as nothing. */
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((text) => text || null);

const offeringFields = {
  kind: z.enum(OFFERING_KINDS),
  title: z.string().trim().min(3).max(100),
  description: clearableText(4000),
  categorySlug: clearableText(40),
  area: clearableText(80),
  region: z.enum(REGION_KEYS).nullish(),
  meetingPoint: clearableText(200),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  durationMinutes: z.number().int().min(15).max(1440),
  priceCents: cents.max(10_000_000),
  priceUnit: z.enum(PRICE_UNITS),
  maxGuests: z.number().int().min(1).max(100),
  minAge: z.number().int().min(0).max(99).nullish(),
  activityLevel: z.enum(ACTIVITY_LEVELS).nullish(),
  skillLevel: z.enum(SKILL_LEVELS).nullish(),
  included: listItems,
  notIncluded: listItems,
  accessibility: z.array(z.enum(ACCESSIBILITY)).max(ACCESSIBILITY.length),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length),
  tags: z.array(z.enum(TAGS)).max(TAGS.length),
};

/** A new experience or service. Lists left out start empty. */
export const offeringInput = z.object({
  ...offeringFields,
  included: offeringFields.included.default([]),
  notIncluded: offeringFields.notIncluded.default([]),
  accessibility: offeringFields.accessibility.default([]),
  languages: offeringFields.languages.default([]),
  tags: offeringFields.tags.default([]),
});

/** A change to one: only the fields sent change. `active: false` takes it off the site without removing it. */
export const offeringUpdate = z.object({ ...offeringFields, active: z.boolean() }).partial();

export const offeringParams = workspaceParams.extend({ offeringId: id });
export const sessionParams = workspaceParams.extend({ sessionId: id });

/** One session on each date, all at the same local start time where the business is. */
export const sessionsInput = z.object({
  dates: z.array(isoDate).min(1).max(60),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour time, e.g. 09:30"),
  capacity: z.number().int().min(1).max(500),
});
