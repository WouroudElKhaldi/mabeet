import type { z } from "zod";
import { recordPlatformAction } from "@/modules/audit/server";
import { lockBusinessMoney } from "@/modules/payments/server";
import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import { addDays, parseIsoDate, todayUtc } from "@/utils/dates";
import type { adminPlanInput } from "../schemas";
import * as billing from "./billing-repository";
import * as planPayments from "./plan-payment-repository";

/**
 * A platform admin sets a place's plan by hand: to help a host, or to settle something agreed with them. A paid plan
 * runs to the end of its last day, when housekeeping puts the place back on Free as after a Whish month, or with no
 * end until an admin changes it. A place paying by card is refused: its plan follows its Stripe subscription, so it
 * is changed in Stripe, and a change made here would be undone by the next webhook.
 */
export async function setPlanAsAdmin(
  actor: PlatformActor,
  businessId: string,
  input: z.infer<typeof adminPlanInput>,
  now = new Date(),
) {
  requirePlatformAdmin(actor);
  const row = await billing.findBilling(prisma, businessId);
  if (!row) throw notFound("Place");
  if (row.stripeSubscriptionId) {
    throw conflict(
      "This place pays by card, so its plan follows its Stripe subscription. Change it in Stripe.",
    );
  }
  const renewsAt = input.lastDay ? addDays(parseIsoDate(input.lastDay), 1) : null;
  if (renewsAt && renewsAt <= todayUtc(now)) throw invalid("That last day is already past");

  await runInTransaction(async (tx) => {
    await lockBusinessMoney(tx, businessId);
    await planPayments.setPlan(tx, businessId, input.plan, renewsAt);
    await recordPlatformAction(
      actor,
      { businessId, action: "business.plan_changed", entity: "business", entityId: businessId },
      tx,
    );
  });
  return { plan: input.plan, renewsAt };
}
