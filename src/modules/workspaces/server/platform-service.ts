import type { BusinessStatus } from "@prisma/client";
import { recordPlatformAction } from "@/modules/audit/server";
import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/errors";
import * as businesses from "./business-repository";

// The platform admin's side of the businesses: every one with its owners, and suspending one.

/** How many businesses the admin pages list at most. */
const BUSINESSES_SHOWN = 200;

/** Every business, the newest first, with its owners, rooms and bookings, and how many there are in all. */
export async function listPlatformBusinesses(actor: PlatformActor) {
  requirePlatformAdmin(actor);
  const [list, total] = await Promise.all([
    businesses.listPlatformBusinesses(prisma, BUSINESSES_SHOWN),
    businesses.countPlatformBusinesses(prisma),
  ]);
  return {
    total,
    businesses: list.map(({ memberships, _count, ...business }) => ({
      ...business,
      owners: memberships.map((membership) => membership.user),
      roomCount: _count.rooms,
      bookingCount: _count.bookings,
    })),
  };
}

/**
 * Suspending hides a business everywhere at once: its page and listing (every public read asks for `ACTIVE`), and
 * its team's access (`resolveContext` does too). Its bookings stay as they are; reactivating brings it all back.
 */
export async function setBusinessStatus(actor: PlatformActor, businessId: string, status: BusinessStatus) {
  requirePlatformAdmin(actor);
  if (!(await businesses.setBusinessStatus(prisma, businessId, status))) throw notFound("Business");
  await recordPlatformAction(actor, {
    businessId,
    action: status === "SUSPENDED" ? "business.suspended" : "business.reactivated",
    entity: "business",
    entityId: businessId,
  });
}
