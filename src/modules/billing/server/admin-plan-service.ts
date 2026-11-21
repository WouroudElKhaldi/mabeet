import type { z } from "zod";
import { recordPlatformAction } from "@/modules/audit/server";
import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import { addDays, parseIsoDate, todayUtc } from "@/utils/dates";
import type { adminPlanInput } from "../schemas";
import * as billing from "./billing-repository";
import * as planPayments from "./plan-payment-repository";

/**
 * A platform admin sets a host's plan by hand, for all their places: to help a host, or to settle something agreed
 * with them. A paid plan runs to the end of its last day, when housekeeping puts the host back on Free as after a
 * Whish month, or with no end until an admin changes it. A host paying by card is refused: their plan follows their
 * Stripe subscription, so it is changed in Stripe, and a change made here would be undone by the next webhook.
 */
export async function setPlanAsAdmin(
  actor: PlatformActor,
  hostId: string,
  input: z.infer<typeof adminPlanInput>,
  now = new Date(),
) {
  requirePlatformAdmin(actor);
  if (!(await billing.findHostJoinedAt(prisma, hostId))) throw notFound("Host");
  const row = await billing.findHostPlan(prisma, hostId);
  if (row.stripeSubscriptionId) {
    throw conflict(
      "This host pays by card, so their plan follows their Stripe subscription. Change it in Stripe.",
    );
  }
  const renewsAt = input.lastDay ? addDays(parseIsoDate(input.lastDay), 1) : null;
  if (renewsAt && renewsAt <= todayUtc(now)) throw invalid("That last day is already past");

  await runInTransaction(async (tx) => {
    await billing.lockHostPlan(tx, hostId);
    await planPayments.setPlan(tx, hostId, input.plan, renewsAt);
    await recordPlatformAction(
      actor,
      { businessId: null, action: "host.plan_changed", entity: "user", entityId: hostId },
      tx,
    );
  });
  return { plan: input.plan, renewsAt };
}
