import type { HostContact } from "@prisma/client";

import type { PublicPlace } from "./types";

// How a place's host is shown to guests: how to reach them, and how they answer. Pure rules, shared by the server
// (which refuses a message the host does not take) and the screens (which only show the ways the host offers).

/** A host's answers are counted over the past year, so an old slow patch fades away. */
export const RESPONSE_WINDOW_DAYS = 365;

/** Fewer requests than this say too little about a host: one missed request would read as a 0% response rate. */
export const MIN_REQUESTS_FOR_RESPONSE = 3;

/**
 * What the host is called on their place's pages: the name on their profile when they show one, otherwise the
 * place's own name, so a page never greets a guest with an empty name.
 */
export const hostDisplayName = (place: Pick<PublicPlace, "name" | "host">): string =>
  place.host.profile?.name ?? place.name;

/** Whether the host takes questions through the Contact host page. */
export const acceptsMessages = (contactBy: HostContact): boolean => contactBy !== "WHATSAPP";

/** Whether the host offers a WhatsApp button. The number is always the place's own. */
export const offersWhatsapp = (contactBy: HostContact): boolean => contactBy !== "MESSAGE";

/** How quickly a host usually answers, in the words guests read (`meetHost.within*`). */
export type ResponseSpeed = "withinHour" | "withinDay" | "withinDays";

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** A typical answer time in minutes, as a guest reads it: within an hour, within a day, or within a few days. */
export function responseSpeed(medianMinutes: number): ResponseSpeed {
  if (medianMinutes <= MINUTES_PER_HOUR) return "withinHour";
  if (medianMinutes <= MINUTES_PER_DAY) return "withinDay";
  return "withinDays";
}

/**
 * How many full years someone has hosted, from the year they started, or null when they did not say. A host who
 * started this year has hosted 0 years: the page then calls them new rather than "0 years hosting".
 */
export function yearsHosting(hostingSince: number | null, now: Date = new Date()): number | null {
  if (hostingSince === null) return null;
  return Math.max(0, now.getUTCFullYear() - hostingSince);
}
