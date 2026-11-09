import type { BookingMode, BookingStatus, BookingUnit, HostContact, PhotoArea } from "@prisma/client";
import type { StayIssue } from "@/config/booking-limits";

// What the public side shows and asks. Plain values only (money as whole cents, dates as ISO text), so a page can
// hand them to a screen that runs in the browser.

export interface RoomQuote {
  roomId: string;
  currency: string;
  /** The price of each night; empty when the stay is too long to price. */
  nights: { date: string; rateCents: number }[];
  nightCount: number;
  /** What the guest pays, in full: there are no deposits. */
  totalCents: number;
  /** Why the stay cannot be booked as asked, or null. */
  issue: StayIssue | null;
}

export interface RoomAvailability {
  roomId: string;
  /** ISO dates a guest cannot sleep there. A guest can still leave on the morning one begins. */
  takenNights: string[];
}

export interface PublicPhoto {
  id: string;
  url: string;
  alt: string | null;
  /** Which part of the place it shows, for the photo tour. */
  area: PhotoArea | null;
}

/** A room, or the whole place as one unit, as a guest sees it. */
export interface PublicUnit {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  baseRateCents: number;
  minNights: number;
  /** Keys from `src/config/amenities.ts`; anything else is ignored on screen. */
  amenities: string[];
  photos: PublicPhoto[];
}

/** A place's host, as its page and its Contact host page show them. */
export interface PublicHost {
  /** How guests may reach the host: WhatsApp, the Contact host page, or both. */
  contactBy: HostContact;
  /** The host's own details, only when they chose to show them. */
  profile: {
    name: string;
    bio: string | null;
    city: string | null;
    /** Language codes, as the host picked them. */
    languages: string[];
    hostingSince: number | null;
  } | null;
  /** How the host answered requests over the past year, or null with too few requests to say. */
  response: {
    /** The share of requests they answered before they expired, from 0 to 1. */
    rate: number;
    /** Their typical answer time in minutes, or null when they answered none. */
    medianMinutes: number | null;
  } | null;
}

/** A place as its page shows it. */
export interface PublicPlace {
  slug: string;
  name: string;
  description: string | null;
  area: string | null;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  /** How many hours the host has to answer a request (the online-with-approval and offline modes). */
  holdHours: number;
  houseRules: string | null;
  bookingUnit: BookingUnit;
  bookingMode: BookingMode;
  /** The place's own WhatsApp number, the only one guests are given; never the host's personal number. */
  whatsapp: string | null;
  host: PublicHost;
  /** The photos of the place as a whole, first one largest. */
  photos: PublicPhoto[];
  /** What a guest can book: the rooms, or the one whole-place unit. */
  units: PublicUnit[];
  /** The rooms, to show. At a place booked whole they are not bookable on their own. */
  rooms: PublicUnit[];
}

/** One of a guest's stays, as their trips list shows it: no payment details, no guest contact, only what the list needs. */
export interface GuestTrip {
  /** The secret in the booking's private link, /b/{publicToken}. */
  publicToken: string;
  reference: string;
  status: BookingStatus;
  bookingMode: BookingMode;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  totalCents: number;
  currency: string;
  place: { name: string; slug: string };
  roomName: string;
}

/** A unit a search found for the guest: free on their dates (when they gave dates) and fitting what they asked. */
export interface SearchOffer {
  roomId: string;
  name: string;
  capacity: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  amenities: string[];
  /** The cheapest night: the base price without dates, the cheapest night of the stay with them. */
  nightlyFromCents: number;
  /** The whole stay, or null when the guest gave no dates. */
  stayTotalCents: number | null;
}

/** A place in search results, with the units that fit. */
export interface PlaceCard {
  slug: string;
  name: string;
  area: string | null;
  currency: string;
  /** The place's first photo, else its first unit's, else none. */
  photo: PublicPhoto | null;
  /** Category slugs. */
  categories: string[];
  nightlyFromCents: number;
  /** The cheapest whole stay, or null without dates. */
  stayTotalFromCents: number | null;
  offers: SearchOffer[];
}

/** One unit of a place over the stay a guest asked about: free or not, whether it fits, and its price. */
interface UnitAvailability {
  roomId: string;
  name: string;
  capacity: number;
  /** Free on every night of the stay. */
  free: boolean;
  /** Why the stay cannot be booked in it as asked (too few nights, too many guests…), or null. */
  issue: StayIssue | null;
  /** The whole stay; null when it is too long to price. */
  totalCents: number | null;
}

/** A place over the stay a guest asked about: each unit it can be booked by. */
export interface PlaceAvailability {
  slug: string;
  name: string;
  currency: string;
  nightCount: number;
  units: UnitAvailability[];
}
