import type { z } from "zod";
import type { Plan } from "@prisma/client";
import { type PaidPlan, PLANS } from "@/config/plans";
import { recordAction, recordPlatformAction } from "@/modules/audit/server";
import { type PlatformActor, requirePlatformAdmin, type TenantContext } from "@/server/auth/tenant-context";
import { type Db, prisma, runInTransaction } from "@/server/db/client";
import { duplicateAsConflict } from "@/server/db/constraint-errors";
import { conflict, forbidden, invalid, notFound } from "@/server/errors";
import { addDays, parseIsoDate, todayUtc } from "@/utils/dates";
import { pageOf } from "@/utils/paging";
import { offerMonthlyCents, offerWindow } from "../offers";
import type { offerInput } from "../schemas";
import * as billing from "./billing-repository";
import * as offers from "./offer-repository";
import * as planPayments from "./plan-payment-repository";

// Plan offers: a platform admin gives hosts a paid plan free, or a share off its price, for every host or one host,
// during each host's first months (from their first place) or between two dates. A free offer is taken from the
// billing page and sets the host's plan until the offer ends, the way a paid Whish month does, so the same
// housekeeping puts the host back on Free afterwards. A percent-off offer is applied by the checkout itself.

const planRank = (plan: Plan) => PLANS.indexOf(plan);

function logOffer(actor: PlatformActor, action: string, offerId: string, db: Db) {
  return recordPlatformAction(
    actor,
    { businessId: null, action, entity: "plan_offer", entityId: offerId },
    db,
  );
}

/**
 * One page of the offers for the admin, newest first, searched and filtered by kind: whether each is running,
 * upcoming or over, and how much it was used.
 */
export async function listOffersForAdmin(
  actor: PlatformActor,
  filters: offers.OfferFilters = { q: "" },
  page = 1,
  now = new Date(),
) {
  requirePlatformAdmin(actor);
  const total = await offers.countOffers(prisma, filters);
  const { skip, take, ...paging } = pageOf(total, page);
  const rows = await offers.listOffers(prisma, filters, { skip, take });
  return {
    total,
    ...paging,
    offers: rows.map(({ isDeleted, host, _count, ...offer }) => ({
      ...offer,
      hostName: host?.name ?? null,
      claims: _count.claims,
      payments: _count.payments,
      state: isDeleted
        ? ("ended" as const)
        : offer.startsAt && offer.startsAt > now
          ? ("upcoming" as const)
          : offer.endsAt && offer.endsAt <= now
            ? ("over" as const)
            : ("running" as const),
    })),
  };
}

/** Adds an offer. Its dates are whole days: from the first day to the end of the last. */
export async function createOffer(actor: PlatformActor, input: z.infer<typeof offerInput>, now = new Date()) {
  requirePlatformAdmin(actor);
  if (input.hostId && !(await billing.findHostJoinedAt(prisma, input.hostId))) throw notFound("Host");
  const startsAt = input.startsOn ? parseIsoDate(input.startsOn) : null;
  const endsAt = input.lastDay ? addDays(parseIsoDate(input.lastDay), 1) : null;
  if (endsAt && endsAt <= todayUtc(now)) throw invalid("Those dates are already past");
  return runInTransaction(async (tx) => {
    const offer = await offers.createOffer(tx, {
      name: input.name,
      plan: input.plan,
      kind: input.kind,
      percentOff: input.kind === "PERCENT_OFF" ? (input.percentOff ?? null) : null,
      hostId: input.hostId,
      firstMonths: input.firstMonths ?? null,
      startsAt,
      endsAt,
      createdById: actor.userId,
    });
    await logOffer(actor, "plan_offer.created", offer.id, tx);
    return offer;
  });
}

/** Ends an offer now. What it already gave stays: a free plan taken runs to its end, a discounted payment is paid. */
export async function endOffer(actor: PlatformActor, offerId: string) {
  requirePlatformAdmin(actor);
  await runInTransaction(async (tx) => {
    if (!(await offers.endOffer(tx, offerId))) throw notFound("Offer");
    await logOffer(actor, "plan_offer.ended", offerId, tx);
  });
}

/**
 * The offers open to a host right now, each with when it ends for them and the monthly price under it. A free offer
 * the host already took is left out.
 */
export async function openOffersFor(hostId: string, joinedAt: Date, now: Date, db: Db = prisma) {
  const [rows, claimed] = await Promise.all([
    offers.listOffersFor(db, hostId),
    offers.listClaimedOfferIds(db, hostId),
  ]);
  return rows.flatMap((offer) => {
    const window = offerWindow(offer, joinedAt);
    if (!window || window.from > now || window.until <= now) return [];
    // The database refuses an offer on Free; the check tells the type so.
    if (offer.plan === "FREE" || (offer.kind === "FREE" && claimed.has(offer.id))) return [];
    const plan: PaidPlan = offer.plan;
    return [
      {
        ...offer,
        plan,
        until: window.until,
        monthlyCents: offerMonthlyCents(plan, offer.kind, offer.percentOff),
      },
    ];
  });
}

/** The largest share off a plan open to a host now, for their checkout; null when there is none. */
export async function bestDiscountFor(hostId: string, joinedAt: Date, plan: PaidPlan, now: Date) {
  const open = await openOffersFor(hostId, joinedAt, now);
  const discounts = open.filter((offer) => offer.kind === "PERCENT_OFF" && offer.plan === plan);
  return discounts.sort((a, b) => (b.percentOff ?? 0) - (a.percentOff ?? 0))[0] ?? null;
}

/**
 * The host takes a free offer: all their places are on the offer's plan until the offer ends for them, and back on
 * Free after that unless they pay. A host paying by card already has their plan running, and a host on a bigger plan
 * would lose it, so both are refused. A host takes each offer once.
 */
export async function claimFreeOffer(ctx: TenantContext, offerId: string, now = new Date()) {
  const place = await billing.findPlaceHost(prisma, ctx.businessId);
  if (!place) throw notFound("Business");
  const hostId = place.hostId;
  if (ctx.userId !== hostId) throw forbidden("Only the host who owns this place can change the plan");
  const [row, joinedAt] = await Promise.all([
    billing.findHostPlan(prisma, hostId),
    billing.findHostJoinedAt(prisma, hostId),
  ]);
  const offer = (await openOffersFor(hostId, joinedAt ?? now, now)).find(
    (open) => open.id === offerId && open.kind === "FREE",
  );
  if (!offer) throw notFound("Offer");
  if (row.stripeSubscriptionId) {
    throw conflict(
      "You pay by card, so your plan is already running. Free offers are for hosts not paying by card.",
    );
  }
  const onBiggerPlan =
    row.planRenewsAt !== null && row.planRenewsAt > now && planRank(row.plan) > planRank(offer.plan);
  if (onBiggerPlan) throw conflict("Your plan already includes everything this offer gives.");

  await duplicateAsConflict("You already took this offer", () =>
    runInTransaction(async (tx) => {
      await billing.lockHostPlan(tx, hostId);
      await offers.createClaim(tx, { offerId, hostId, endsAt: offer.until });
      // Months already paid on the same plan are kept when they run past the offer.
      const until =
        row.plan === offer.plan && row.planRenewsAt && row.planRenewsAt > offer.until
          ? row.planRenewsAt
          : offer.until;
      await planPayments.setPlan(tx, hostId, offer.plan, until);
      await recordAction(ctx, "billing.offer_claimed", "plan_offer", offerId, tx);
    }),
  );
  return { plan: offer.plan, until: offer.until };
}
