import type { z } from "zod";
import { isOnlineMode } from "@/config/enums";
import { type RegionKey, regionOfArea } from "@/config/regions";
import { recordAction } from "@/modules/audit/server";
import { requireOwner, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { invalid, notFound } from "@/server/errors";
import type { settingsInput } from "../schemas";
import * as businesses from "./business-repository";

// The place's settings: contact, prices' currency, the owner's answer time, check-in and check-out, house rules, and
// how guests book and pay (the booking mode). How money flows is the owner's choice alone, so changing the mode, or
// accepting the payment policy, needs the owner as well as settings.manage.

type SettingsInput = z.infer<typeof settingsInput>;

const ONLY_OWNER_DECIDES = "Only an owner can choose how guests book and pay";
const ACCEPT_REFUNDS_FIRST =
  "To take payments online, first accept that online payments are always refunded in full.";

async function loadSettings(businessId: string) {
  const settings = await businesses.findBusinessSettings(prisma, businessId);
  if (!settings) throw notFound("Business");
  return settings;
}

export async function getSettings(ctx: TenantContext) {
  requirePermission(ctx, "settings.manage");
  return loadSettings(ctx.businessId);
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

/** Saves the fields sent and returns the settings as they now are. */
export async function updateSettings(ctx: TenantContext, input: SettingsInput, now = new Date()) {
  requirePermission(ctx, "settings.manage");
  const { acceptOnlineTerms, ...fields } = input;
  if (fields.bookingMode !== undefined || acceptOnlineTerms) requireOwner(ctx, ONLY_OWNER_DECIDES);

  const current = await loadSettings(ctx.businessId);
  const accepted = Boolean(current.onlineTermsAcceptedAt) || acceptOnlineTerms === true;
  if (fields.bookingMode && isOnlineMode(fields.bookingMode) && !accepted)
    throw invalid(ACCEPT_REFUNDS_FIRST);

  return runInTransaction(async (tx) => {
    const saved = await businesses.updateBusinessSettings(tx, ctx.businessId, {
      ...fields,
      ...regionFor(input, current.area),
      ...(acceptOnlineTerms && !current.onlineTermsAcceptedAt && { onlineTermsAcceptedAt: now }),
    });
    await recordAction(ctx, "settings.updated", "business", ctx.businessId, tx);
    return saved;
  });
}
