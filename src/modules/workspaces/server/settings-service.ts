import type { BookingUnit } from "@prisma/client";
import type { z } from "zod";
import { isOnlineMode } from "@/config/enums";
import { type RegionKey, regionOfArea } from "@/config/regions";
import { listCategories } from "@/modules/admin/server";
import { recordAction } from "@/modules/audit/server";
import { requireOwner, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction, type Tx } from "@/server/db/client";
import { invalid, notFound } from "@/server/errors";
import type { settingsInput } from "../schemas";
import * as businesses from "./business-repository";

// The place's settings: contact, prices' currency, the owner's answer time, check-in and check-out, house rules, its
// categories, and how guests pay (the booking mode). Booking room by room or as a whole is the rooms module's
// (`chooseBookingUnit`), as it needs the whole-place unit. How money flows is
// the owner's choice alone, so changing the mode, or accepting the payment policy, needs the owner as well as
// settings.manage.

type SettingsInput = z.infer<typeof settingsInput>;

const ONLY_OWNER_DECIDES = "Only an owner can choose how guests book and pay";
const ACCEPT_REFUNDS_FIRST =
  "To take payments online, first accept that online payments are always refunded in full.";

/** The settings as the screen reads them: the categories as their slugs. */
function present(settings: NonNullable<Awaited<ReturnType<typeof businesses.findBusinessSettings>>>) {
  return { ...settings, categories: settings.categories.map((category) => category.categorySlug) };
}

async function loadSettings(businessId: string) {
  const settings = await businesses.findBusinessSettings(prisma, businessId);
  if (!settings) throw notFound("Business");
  return settings;
}

export async function getSettings(ctx: TenantContext) {
  requirePermission(ctx, "settings.manage");
  return present(await loadSettings(ctx.businessId));
}

/**
 * The region to save when the town or the region changes: the host's pick, or else the one their town is in
 * ("Ehden" → north). Nothing changes when neither was sent.
 */
function regionFor(input: SettingsInput, currentArea: string | null): { region?: RegionKey | null } {
  if (input.region === undefined && input.area === undefined) return {};
  if (input.region) return { region: input.region };
  return { region: regionOfArea(input.area !== undefined ? input.area : currentArea) };
}

/** A place picks from the admin's place categories: an unknown slug is a clear refusal, not a database error. */
async function assertKnownCategories(slugs: readonly string[]) {
  const known = new Set((await listCategories("HOME")).map((category) => category.slug));
  const unknown = slugs.filter((slug) => !known.has(slug));
  if (unknown.length > 0) throw invalid(`Unknown categories: ${unknown.join(", ")}`);
}

/** Saves the fields sent and returns the settings as they now are. */
export async function updateSettings(ctx: TenantContext, input: SettingsInput, now = new Date()) {
  requirePermission(ctx, "settings.manage");
  const { acceptOnlineTerms, categories, ...fields } = input;
  if (fields.bookingMode !== undefined || acceptOnlineTerms) requireOwner(ctx, ONLY_OWNER_DECIDES);

  const current = await loadSettings(ctx.businessId);
  const accepted = Boolean(current.onlineTermsAcceptedAt) || acceptOnlineTerms === true;
  if (fields.bookingMode && isOnlineMode(fields.bookingMode) && !accepted)
    throw invalid(ACCEPT_REFUNDS_FIRST);
  if (categories) await assertKnownCategories(categories);

  return runInTransaction(async (tx) => {
    if (categories) await businesses.setBusinessCategories(tx, ctx.businessId, categories);
    const saved = await businesses.updateBusinessSettings(tx, ctx.businessId, {
      ...fields,
      ...regionFor(input, current.area),
      ...(acceptOnlineTerms && !current.onlineTermsAcceptedAt && { onlineTermsAcceptedAt: now }),
    });
    await recordAction(ctx, "settings.updated", "business", ctx.businessId, tx);
    return present(saved);
  });
}

/**
 * Saves how the place is booked, room by room or as a whole. For the rooms module's `chooseBookingUnit`, inside its
 * transaction and after its own checks (it gives the place its whole-place unit first). Returns the place's name.
 */
export async function saveBookingUnit(businessId: string, bookingUnit: BookingUnit, tx: Tx) {
  const { name } = await businesses.updateBusinessSettings(tx, businessId, { bookingUnit });
  return name;
}

/**
 * What every dashboard page may show of the place, to any of its members: its name, the currency its prices are in,
 * and whether it is booked room by room or as a whole.
 */
export async function getPlaceBasics(ctx: TenantContext) {
  const { name, currency, bookingUnit, bookingMode } = await loadSettings(ctx.businessId);
  return { name, currency, bookingUnit, bookingMode };
}
