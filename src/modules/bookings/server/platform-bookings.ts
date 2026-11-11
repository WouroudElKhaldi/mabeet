import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import * as bookings from "./booking-repository";

/** The days the admin overview counts as "recent". */
const RECENT_DAYS = 30;

/** How many bookings were asked for on the whole platform, all time and in the last 30 days. */
export function countPlatformBookings(actor: PlatformActor, now = new Date()) {
  requirePlatformAdmin(actor);
  return bookings.countPlatformBookings(prisma, new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60_000));
}

/** How many of a person's stays their admin page lists: the latest ones. */
const TRIPS_SHOWN = 10;

/** A person's latest stays for the admin, newest first: where, when, and how each stands. */
export async function listPersonTripsForAdmin(actor: PlatformActor, userId: string) {
  requirePlatformAdmin(actor);
  const trips = await bookings.listGuestBookings(prisma, userId, TRIPS_SHOWN);
  return trips.map((trip) => ({
    id: trip.id,
    reference: trip.reference,
    status: trip.status,
    checkIn: trip.checkIn,
    checkOut: trip.checkOut,
    totalCents: trip.totalCents,
    currency: trip.currency,
    placeName: trip.business.name,
    roomName: trip.room.name,
  }));
}
