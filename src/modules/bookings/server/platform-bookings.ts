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
