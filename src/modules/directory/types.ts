import type { BookingMode, BookingUnit, PhotoArea } from "@prisma/client";
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

/** A place as its page shows it. */
export interface PublicPlace {
  slug: string;
  name: string;
  description: string | null;
  area: string | null;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string | null;
  bookingUnit: BookingUnit;
  bookingMode: BookingMode;
  /** The photos of the place as a whole, first one largest. */
  photos: PublicPhoto[];
  /** What a guest can book: the rooms, or the one whole-place unit. */
  units: PublicUnit[];
  /** The rooms, to show. At a place booked whole they are not bookable on their own. */
  rooms: PublicUnit[];
}
