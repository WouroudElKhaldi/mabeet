import ical from "ical-generator";
import { BRAND } from "@/config/brand";
import type { DateRange } from "@/utils/dates";

/** One run of taken nights in a room's calendar link. `id` never changes for the same stay or closed dates. */
export interface ExportEvent extends DateRange {
  id: string;
}

/**
 * The platforms follow each event by its id. Changing this suffix would make every taken night look deleted and
 * made again on Airbnb and Booking.com, so it never changes.
 */
const EVENT_UID_DOMAIN = "mabeet";

/**
 * A room's taken nights, for Airbnb and Booking.com to read. Every event says only "Not available": no guest name,
 * phone or email ever leaves through this file.
 */
export function buildExportFeed(calendarName: string, events: readonly ExportEvent[]): string {
  const calendar = ical({
    name: calendarName,
    prodId: { company: BRAND.name, product: "availability" },
  });
  for (const event of events) {
    calendar.createEvent({
      id: `${event.id}@${EVENT_UID_DOMAIN}`,
      start: event.checkIn,
      end: event.checkOut,
      allDay: true,
      summary: "Not available",
    });
  }
  return calendar.toString();
}
