import type { BookingMode } from "@prisma/client";
import { z } from "zod";
import { AMENITIES } from "@/config/amenities";
import { ACCESSIBILITY, TAGS } from "@/config/listing";
import { REGION_KEYS } from "@/config/regions";
import {
  acceptsMessages,
  hostDisplayName,
  offersWhatsapp,
  type PublicPlace,
  type ResponseSpeed,
  responseSpeed,
  yearsHosting,
} from "@/modules/directory";
import { checkPlaceAvailability, getPlace, searchPlaces } from "@/modules/directory/server";
import { env } from "@/server/env";
import { notFound } from "@/server/errors";
import { optionalDateRange, toDateRange } from "@/utils/dates";
import { defineTool } from "./tool";

// What a guest's own AI app may ask about places, with no sign-in. Read only, over listed places and public fields:
// never a booking, a guest, or anything a host has not published. A booking always happens on the place's page,
// through the link each answer gives.

const isoDate = z.iso.date().describe("YYYY-MM-DD");
/**
 * Enough for a whole region at once. One more is read to say whether others match, so the guest's AI narrows the
 * search instead of calling it over and over to guess the rest.
 */
const MAX_RESULTS = 20;

const slug = z.string().min(1).max(80).describe("The place's slug, from search_places");
const atLeast = (what: string) =>
  z.number().int().min(1).max(20).optional().describe(`At least this many ${what}`);

/** The place's page, where the guest books, with their stay already picked when they gave one. */
function bookingLink(
  placeSlug: string,
  stay?: { checkIn: string; checkOut: string; guests: number },
): string {
  const url = new URL(`/p/${placeSlug}`, env.BETTER_AUTH_URL);
  if (stay) {
    url.searchParams.set("checkIn", stay.checkIn);
    url.searchParams.set("checkOut", stay.checkOut);
    url.searchParams.set("guests", String(stay.guests));
  }
  return url.toString();
}

/** How booking and paying work, in the words the model repeats to the guest. */
function howToBook(mode: BookingMode, holdHours: number): string {
  if (mode === "AUTOMATIC")
    return "Instant: the guest pays the full price online, and the stay is confirmed at once.";
  if (mode === "ONLINE_APPROVAL") {
    return `A request: the guest pays the full price online, and the host confirms within ${holdHours} hours; a declined request is refunded in full.`;
  }
  return `A request: the host answers within ${holdHours} hours, and the guest pays the host directly, as the host explains.`;
}

const REFUNDS = "A booking paid online and then cancelled is always refunded in full.";

/** How quickly the host usually answers, in the words the place's page uses. */
const ANSWERS_WITHIN: Record<ResponseSpeed, string> = {
  withinHour: "within an hour",
  withinDay: "within a day",
  withinDays: "within a few days",
};

/**
 * The host as the place's Meet your host section shows them: their own details only when they turned their profile
 * on, and only the ways to reach them they offer. The WhatsApp number is the place's, never the host's own.
 */
function publicHost(place: PublicPlace) {
  const { profile, response, contactBy } = place.host;
  return {
    name: hostDisplayName(place),
    about: profile?.bio ?? null,
    city: profile?.city ?? null,
    languages: profile?.languages ?? [],
    yearsHosting: yearsHosting(profile?.hostingSince ?? null),
    responseRate: response === null ? null : `${Math.round(response.rate * 100)}%`,
    usuallyAnswers:
      response === null || response.medianMinutes === null
        ? null
        : ANSWERS_WITHIN[responseSpeed(response.medianMinutes)],
    whatsapp: offersWhatsapp(contactBy) ? place.whatsapp : null,
    contactPage: acceptsMessages(contactBy, place.whatsapp)
      ? new URL(`/p/${place.slug}/contact`, env.BETTER_AUTH_URL).toString()
      : null,
  };
}

export const GUEST_TOOLS = [
  defineTool({
    name: "search_places",
    description:
      "Find guesthouses and homes in Lebanon. With dates, only places with a room free on every night are returned, priced for the stay. Turn every part of the guest's wish into a filter: area (a town, or a region such as North Lebanon), categories (mountain, beach, countryside, old-town, guesthouse, cabin, vineyard, ski), bedrooms, bathrooms and beds, amenities (jacuzzi, pool, fireplace…), tags, accessibility and a budget per night. Use free words only for what no filter covers. Each result lists its matching rooms with their layout and amenities. Returns up to 20 places; when moreMatch is true, more places match than were returned, so narrow the search (area, dates, budget) to see the others. An empty list means nothing matches: say so rather than suggest something else.",
    input: z.object({
      checkIn: isoDate.optional(),
      checkOut: isoDate.optional().describe("The morning the guest leaves"),
      guests: z.number().int().min(1).max(30).default(2),
      area: z
        .string()
        .max(60)
        .optional()
        .describe(`A town (Ehden, Batroun…) or a region: ${REGION_KEYS.join(", ")}`),
      categories: z.array(z.string().max(40)).max(4).optional(),
      maxPricePerNight: z
        .number()
        .int()
        .min(1)
        .max(100_000)
        .optional()
        .describe("In the place's currency, usually USD"),
      minBedrooms: atLeast("bedrooms"),
      minBathrooms: atLeast("bathrooms"),
      minBeds: atLeast("beds"),
      amenities: z.array(z.enum(AMENITIES)).max(6).optional().describe("The room or home has every one"),
      tags: z.array(z.enum(TAGS)).max(4).optional().describe("The place has at least one"),
      accessibility: z.array(z.enum(ACCESSIBILITY)).max(4).optional().describe("The place has every one"),
      text: z.string().max(120).optional().describe("Free words no filter covers"),
    }),
    mutates: false,
    run: async (input) => {
      const range = optionalDateRange(input.checkIn, input.checkOut);
      const stay =
        range && input.checkIn && input.checkOut
          ? { checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests }
          : undefined;
      const places = await searchPlaces({
        guests: input.guests,
        area: input.area,
        text: input.text,
        categories: input.categories,
        amenities: input.amenities,
        tags: input.tags,
        accessibility: input.accessibility,
        maxRateCents: input.maxPricePerNight && input.maxPricePerNight * 100,
        minBedrooms: input.minBedrooms,
        minBathrooms: input.minBathrooms,
        minBeds: input.minBeds,
        range,
        limit: MAX_RESULTS + 1,
      });
      const cards = places.slice(0, MAX_RESULTS).map((place) => ({
        slug: place.slug,
        name: place.name,
        area: place.area,
        categories: place.categories,
        currency: place.currency,
        nightlyFromCents: place.nightlyFromCents,
        stayTotalFromCents: place.stayTotalFromCents,
        photoUrl: place.photo?.url ?? null,
        bookingLink: bookingLink(place.slug, stay),
        rooms: place.offers.map((offer) => ({
          name: offer.name,
          sleeps: offer.capacity,
          bedrooms: offer.bedrooms,
          bathrooms: offer.bathrooms,
          beds: offer.beds,
          amenities: offer.amenities,
          nightlyFromCents: offer.nightlyFromCents,
          stayTotalCents: offer.stayTotalCents,
        })),
      }));
      return { places: cards, moreMatch: places.length > MAX_RESULTS };
    },
  }),
  defineTool({
    name: "check_availability",
    description:
      "Is one place free for a stay? Returns each room (or the whole place, for a place booked as a whole) as free or taken, the price of the stay, and why a stay does not fit a room (too few nights for its minimum, more guests than it sleeps, too far ahead).",
    input: z
      .object({
        slug,
        checkIn: isoDate,
        checkOut: isoDate,
        guests: z.number().int().min(1).max(30).optional(),
      })
      .refine(({ checkIn, checkOut }) => checkOut > checkIn, {
        message: "Check-out must be after check-in",
        path: ["checkOut"],
      }),
    mutates: false,
    run: async ({ slug: placeSlug, checkIn, checkOut, guests }) => {
      const availability = await checkPlaceAvailability(placeSlug, {
        range: toDateRange({ checkIn, checkOut }),
        guests: guests ?? null,
      });
      return {
        ...availability,
        bookingLink: bookingLink(placeSlug, { checkIn, checkOut, guests: guests ?? 1 }),
      };
    },
  }),
  defineTool({
    name: "get_place",
    description:
      "The public page of one place: its description, town, rooms with their layout, price and amenities, check-in and check-out times, house rules, whether it is booked room by room or as a whole, how booking and paying work, and its host: who they are, how quickly they answer, and how to reach them (the place's WhatsApp and its Contact host page, as the host chose).",
    input: z.object({ slug }),
    mutates: false,
    run: async ({ slug: placeSlug }) => {
      const place = await getPlace(placeSlug);
      if (!place) throw notFound("Place");
      const whole = place.bookingUnit === "WHOLE_PLACE";
      return {
        slug: place.slug,
        name: place.name,
        area: place.area,
        description: place.description,
        currency: place.currency,
        checkIn: place.checkInTime,
        checkOut: place.checkOutTime,
        houseRules: place.houseRules,
        bookedAs: whole ? "the whole place" : "room by room",
        booking: howToBook(place.bookingMode, place.holdHours),
        refunds: REFUNDS,
        units: place.units.map((unit) => ({
          name: unit.name,
          sleeps: unit.capacity,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          beds: unit.beds,
          minNights: unit.minNights,
          nightlyRateCents: unit.baseRateCents,
          amenities: unit.amenities,
        })),
        roomsInside: whole ? place.rooms.map((room) => ({ name: room.name, beds: room.beds })) : [],
        host: publicHost(place),
        bookingLink: bookingLink(place.slug),
      };
    },
  }),
];
