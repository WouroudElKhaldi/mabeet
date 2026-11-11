import { BOOKABLE_ROOM_KIND } from "@/config/booking-limits";
import { SETUP_PHOTOS, SETUP_STEPS, type SetupStep } from "@/config/setup";
import { getSettings } from "@/modules/workspaces/server";
import type { TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import * as photos from "./photo-repository";
import * as rooms from "./room-repository";

// What a new place still needs before guests can find it, worked out from what is saved, so a step ticks itself the
// moment the host does it on its own page. It lives here because the rooms and the photos are this module's, and the
// place's own fields are read through workspaces.

/**
 * Each step of getting a place ready, in order, done or not, and whether the place is already listed. Read under
 * settings.manage: the steps lead to pages only the people who run the place can use.
 */
export async function getSetupChecklist(ctx: TenantContext) {
  const settings = await getSettings(ctx);
  const [photoCount, units] = await Promise.all([
    photos.countPhotos(prisma, { businessId: ctx.businessId, roomId: null }),
    rooms.countActiveUnits(prisma, ctx.businessId, BOOKABLE_ROOM_KIND[settings.bookingUnit]),
  ]);
  const done: Record<SetupStep, boolean> = {
    describe: Boolean(settings.description?.trim() && settings.area),
    photos: photoCount >= SETUP_PHOTOS,
    rooms: units > 0,
    // Offline, guests pay the host directly, so they need to be told how; online, the host has accepted the full
    // refund rule, which an online mode cannot be chosen without.
    booking:
      settings.bookingMode === "OFFLINE"
        ? Boolean(settings.paymentInstructions?.trim())
        : settings.onlineTermsAcceptedAt !== null,
    contact: Boolean(settings.whatsapp || settings.phone),
    publish: settings.listedPublicly,
  };
  const steps = SETUP_STEPS.map((key) => ({ key, done: done[key] }));
  return {
    steps,
    photoCount,
    listed: settings.listedPublicly,
    /** Every step before publishing is done. */
    ready: steps.every((step) => step.key === "publish" || step.done),
  };
}
