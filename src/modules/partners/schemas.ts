import { z } from "zod";
import { PARTNER_KINDS } from "@/config/partner-kinds";
import { REGION_KEYS } from "@/config/regions";
import { id, isoDate, phone } from "@/lib/schemas";

// Input checks for featured partners (F23). Platform admins write them; guests only ever read partners.

/** A link shown to guests: only https, so the page never loads anything over plain http. */
const httpsLink = z.url({ protocol: /^https$/ }).max(500);

/**
 * A partner place, whole: the editor always sends every field, so creating and changing check the same thing. A map
 * pin is both halves or neither.
 */
export const partnerInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    kind: z.enum(PARTNER_KINDS),
    region: z.enum(REGION_KEYS),
    area: z.string().trim().max(80).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    photoUrl: httpsLink.nullable(),
    websiteUrl: httpsLink.nullable(),
    phone: phone.nullable(),
  })
  .refine((partner) => (partner.latitude === null) === (partner.longitude === null), {
    message: "Give both halves of the map pin, or neither",
    path: ["longitude"],
  });

/**
 * The dates a partner is sponsored. `endsOn` is the day after the last one, like a check-out, so a one-day
 * sponsorship ends the next day.
 */
export const sponsorshipInput = z
  .object({ startsOn: isoDate, endsOn: isoDate })
  .refine((dates) => dates.endsOn > dates.startsOn, {
    message: "The last day must be on or after the first",
    path: ["endsOn"],
  });

export const partnerParams = z.object({ partnerId: id });
export const sponsorshipParams = z.object({ partnerId: id, sponsorshipId: id });
