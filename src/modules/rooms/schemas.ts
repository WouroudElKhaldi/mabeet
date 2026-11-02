import { z } from "zod";
import { AMENITIES } from "@/config/amenities";
import { BOOKING_UNITS, PHOTO_AREAS } from "@/config/enums";
import { cents, id, stayDates, workspaceParams } from "@/lib/schemas";
import { countNights, toDateRange } from "@/utils/dates";

/** One special price at a time covers a year at most. */
const MAX_SPECIAL_PRICE_NIGHTS = 366;

export const roomParams = workspaceParams.extend({ roomId: id });

const count = (max: number) => z.number().int().min(0).max(max);

// Without defaults: an update changes only what it sends, so a missing field must stay missing, not reset.
const roomFields = {
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(4000).nullish(),
  capacity: z.number().int().min(1).max(30),
  bedrooms: count(30),
  beds: count(60),
  bathrooms: count(30),
  baseRateCents: cents,
  minNights: z.number().int().min(1).max(60),
  amenities: z
    .array(z.enum(AMENITIES))
    .max(AMENITIES.length)
    .refine((list) => new Set(list).size === list.length, "List each amenity once"),
  active: z.boolean(),
};

export const roomInput = z.object({
  ...roomFields,
  bedrooms: roomFields.bedrooms.default(1),
  beds: roomFields.beds.default(1),
  bathrooms: roomFields.bathrooms.default(1),
  minNights: roomFields.minNights.default(1),
  amenities: roomFields.amenities.default([]),
  active: roomFields.active.default(true),
});

export const roomUpdate = z.object(roomFields).partial();

/** A special price for every night of the range (check-out night excluded); a null price clears them. */
export const specialPriceInput = stayDates
  .safeExtend({ rateCents: cents.nullable() })
  .refine((range) => countNights(toDateRange(range)) <= MAX_SPECIAL_PRICE_NIGHTS, {
    message: `Set special prices for at most ${MAX_SPECIAL_PRICE_NIGHTS} nights at a time`,
    path: ["checkOut"],
    // Zod still runs this after a field failed; only real dates can be counted.
    when: (payload) => payload.issues.length === 0,
  });

/** How the place is booked: room by room, or the whole place as one unit. */
export const bookingUnitInput = z.object({ bookingUnit: z.enum(BOOKING_UNITS) });

/** /api/workspaces/{businessId}/photos/{photoId} */
export const photoParams = workspaceParams.extend({ photoId: id });

/** The form fields sent with a photo's file: a room's photo, or (no room) the place's own. */
export const photoUploadFields = z.object({
  roomId: id.nullable().default(null),
  alt: z.string().trim().max(160).nullable().default(null),
  area: z.enum(PHOTO_AREAS).nullable().default(null),
});

/** `{ "cover": true }` puts the photo first; `{ area, alt }` tags it for the photo tour. */
export const photoChange = z.union([
  z.object({ cover: z.literal(true) }),
  z.object({ area: z.enum(PHOTO_AREAS).nullable().optional(), alt: z.string().trim().max(160).nullish() }),
]);

/** An uploaded file's id in /api/images/{imageId}. */
export const imageParams = z.object({ imageId: z.string().regex(/^[a-z0-9]{10,40}$/) });
