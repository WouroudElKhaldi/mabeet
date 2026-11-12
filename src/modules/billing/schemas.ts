import { z } from "zod";
import { MAX_OFFER_FIRST_MONTHS, OFFER_KINDS, PAID_PLANS, PLANS } from "@/config/plans";
import { id, isoDate, listChoice, listQuery, workspaceParams } from "@/lib/schemas";

/** A plan a host can pay for, as /pricing passes it to /host (`?plan=PRO`). */
export const paidPlan = z.enum(PAID_PLANS);

/** A paid plan, by card (Stripe) or by Whish. */
export const checkoutInput = z.object({ plan: paidPlan });

/** Whish calls back by GET with the query we gave it: whose payment, and whether the attempt failed. */
export const whishCallbackQuery = z.object({
  payment: id.optional(),
  plan: id.optional(),
  attempt: z.literal("failed").optional(),
});

// ---------- Plan offers ----------

/**
 * A platform admin's offer. `kind` FREE gives the plan with nothing to pay; PERCENT_OFF takes `percentOff` off its
 * price. `businessId` is one host's place, or null for every place. The time is either `firstMonths` (each place's
 * first months, from the day it joined) or `startsOn` to `lastDay`, both days included.
 */
export const offerInput = z
  .object({
    name: z.string().trim().min(3).max(60),
    plan: paidPlan,
    kind: z.enum(OFFER_KINDS),
    percentOff: z.number().int().min(1).max(99).optional(),
    businessId: id.nullable().default(null),
    firstMonths: z.number().int().min(1).max(MAX_OFFER_FIRST_MONTHS).optional(),
    startsOn: isoDate.optional(),
    lastDay: isoDate.optional(),
  })
  .superRefine((offer, context) => {
    if ((offer.kind === "PERCENT_OFF") !== (offer.percentOff !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["percentOff"],
        message:
          offer.kind === "PERCENT_OFF" ? "Say how much is taken off" : "A free offer has no percentage",
      });
    }
    const byDates = offer.startsOn !== undefined || offer.lastDay !== undefined;
    if (byDates === (offer.firstMonths !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["firstMonths"],
        message: "Choose either the first months or two dates",
      });
    } else if (byDates && !(offer.startsOn && offer.lastDay && offer.lastDay >= offer.startsOn)) {
      context.addIssue({
        code: "custom",
        path: ["lastDay"],
        message: "The last day must be on or after the first",
      });
    }
  });

export const offerParams = z.object({ offerId: id });

/** The admin's offers table: words in the offer's or its place's name, and the kind of offer. */
export const offersQuery = listQuery.extend({ kind: listChoice(OFFER_KINDS) });

/** A host taking a free offer for their place. */
export const claimOfferParams = workspaceParams.extend({ offerId: id });

/**
 * A platform admin setting a place's plan by hand: a paid plan until its last day (included), or with no end until
 * an admin changes it again; Free has no end.
 */
export const adminPlanInput = z
  .object({ plan: z.enum(PLANS), lastDay: isoDate.nullable().default(null) })
  .refine((input) => input.plan !== "FREE" || input.lastDay === null, {
    message: "Free has no end date",
    path: ["lastDay"],
  });
