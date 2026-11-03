import { z } from "zod";
import { PAID_PLANS } from "@/config/plans";
import { id } from "@/lib/schemas";

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
