import type { z } from "zod";
import { type OfferingKind } from "@/config/enums";
import { regionOfArea } from "@/config/regions";
import { listCategories } from "@/modules/admin/server";
import { recordAction } from "@/modules/audit/server";
import { assertPlanAllowsAnother } from "@/modules/billing/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { plainRows, prisma, runInTransaction } from "@/server/db/client";
import { invalid, notFound } from "@/server/errors";
import { uniqueSlug } from "@/utils/slug";
import { zonedInstant } from "@/utils/zoned-time";
import type { offeringInput, offeringUpdate, sessionsInput } from "../schemas";
import * as offerings from "./offering-repository";

// The team's side of experiences and services: the catalogue and its schedule. Who has booked which seats is the
// booking engine's, so cancelling a session with guests on it is refused there (bookings, cancelSession).

type OfferingInput = z.infer<typeof offeringInput>;
type OfferingUpdate = z.infer<typeof offeringUpdate>;

/** A category must exist and be of the same type: an experience cannot be filed under a service's category. */
async function assertCategoryFits(kind: OfferingKind, categorySlug: string | null) {
  if (!categorySlug) return;
  const known = await listCategories(kind);
  if (!known.some((category) => category.slug === categorySlug)) {
    throw invalid("Pick one of the categories for this type");
  }
}

/** The business's experiences and services, with their photos and upcoming sessions. */
export async function listOfferings(ctx: TenantContext, now = new Date()) {
  requirePermission(ctx, "offerings.manage");
  return plainRows(await offerings.listOfferings(prisma, ctx.businessId, now));
}

export async function createOffering(ctx: TenantContext, input: OfferingInput) {
  requirePermission(ctx, "offerings.manage");
  await assertCategoryFits(input.kind, input.categorySlug);
  const slug = await uniqueSlug(input.title, "experience", (candidate) =>
    offerings.slugTaken(prisma, candidate),
  );
  return runInTransaction(async (tx) => {
    // Counted inside the transaction that adds it, so two added at once cannot pass the plan's limit together.
    await assertPlanAllowsAnother(ctx.businessId, "offerings", tx);
    const offering = await offerings.createOffering(tx, {
      ...input,
      // The host's pick, or else the region the town is in, so a search by region finds it.
      region: input.region ?? regionOfArea(input.area),
      businessId: ctx.businessId,
      slug,
    });
    await recordAction(ctx, "offering.created", "offering", offering.id, tx);
    return offering;
  });
}

export async function updateOffering(ctx: TenantContext, offeringId: string, input: OfferingUpdate) {
  requirePermission(ctx, "offerings.manage");
  const current = await offerings.findOffering(prisma, ctx.businessId, offeringId);
  if (!current) throw notFound("Experience");
  const kind = input.kind ?? (current.kind === "SERVICE" ? "SERVICE" : "EXPERIENCE");
  if (input.kind !== undefined || input.categorySlug !== undefined) {
    await assertCategoryFits(
      kind,
      input.categorySlug !== undefined ? input.categorySlug : current.categorySlug,
    );
  }
  // A new town without a region picked: the region follows the town.
  const region =
    input.region !== undefined || input.area !== undefined
      ? { region: input.region ?? regionOfArea(input.area !== undefined ? input.area : current.area) }
      : {};
  return runInTransaction(async (tx) => {
    if (!(await offerings.updateOffering(tx, ctx.businessId, offeringId, { ...input, ...region }))) {
      throw notFound("Experience");
    }
    await recordAction(ctx, "offering.updated", "offering", offeringId, tx);
    const updated = await offerings.findOffering(tx, ctx.businessId, offeringId);
    if (!updated) throw notFound("Experience");
    return updated;
  });
}

/**
 * Schedules one session on each date, all at the same local time where the business is (17:00 in Beirut is stored as
 * the instant it happens there, summer time or not). Only sessions that start in the future.
 */
export async function scheduleSessions(
  ctx: TenantContext,
  offeringId: string,
  input: z.infer<typeof sessionsInput>,
  now = new Date(),
) {
  requirePermission(ctx, "offerings.manage");
  const offering = await offerings.findOfferingToSchedule(prisma, ctx.businessId, offeringId);
  if (!offering) throw notFound("Experience");
  const sessions = [...new Set(input.dates)].sort().map((date) => {
    const startsAt = zonedInstant(date, input.time, offering.business.timezone);
    return {
      businessId: ctx.businessId,
      offeringId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + offering.durationMinutes * 60_000),
      capacity: input.capacity,
    };
  });
  if (sessions.some((session) => session.startsAt <= now)) throw invalid("Sessions must start in the future");
  return runInTransaction(async (tx) => {
    const created = await offerings.createSessions(tx, sessions);
    await recordAction(ctx, "session.scheduled", "offering", offeringId, tx);
    return created;
  });
}
