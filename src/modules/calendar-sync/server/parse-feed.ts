import ical, { type CalendarComponent, type DateWithTimeZone, type VEvent } from "node-ical";
import { addDays, type DateRange, parseIsoDate } from "@/utils/dates";

/** One stay read from a platform's calendar: its nights, and the id the platform keeps for it. */
export interface FeedEvent extends DateRange {
  uid: string;
}

export interface ParseWindow {
  from: Date;
  to: Date;
  /** The place's time zone: a date-time is read as the date it is at the place. */
  timezone: string;
}

/** All-day values come back as local midnight; read their calendar date, not their UTC instant. */
function dateOnlyToUtc(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** Date-times (the odd calendar sends them) become the calendar date at the place. */
function dateTimeToPlaceDate(date: Date, timezone: string): Date {
  return parseIsoDate(new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date));
}

function toNight(value: DateWithTimeZone, timezone: string): Date {
  return value.dateOnly ? dateOnlyToUtc(value) : dateTimeToPlaceDate(value, timezone);
}

function isEvent(component: CalendarComponent | undefined): component is VEvent {
  return component?.type === "VEVENT";
}

function toFeedEvent(event: VEvent, timezone: string): FeedEvent | null {
  if (!event.uid || !event.start || event.status === "CANCELLED") return null;
  const checkIn = toNight(event.start, timezone);
  // An all-day event with no end is a single night.
  const checkOut = event.end ? toNight(event.end, timezone) : addDays(checkIn, 1);
  return checkOut > checkIn ? { uid: event.uid, checkIn, checkOut } : null;
}

/**
 * Reads an Airbnb, Booking.com or other .ics file into stays inside the window. Cancelled events, events with no id
 * (they could not be followed from one read to the next) and stays wholly outside the window are left out.
 */
export function parseFeed(icsText: string, { from, to, timezone }: ParseWindow): FeedEvent[] {
  return Object.values(ical.sync.parseICS(icsText))
    .filter(isEvent)
    .map((event) => toFeedEvent(event, timezone))
    .filter((event): event is FeedEvent => event !== null && event.checkOut > from && event.checkIn < to);
}
