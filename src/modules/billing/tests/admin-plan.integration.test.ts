import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { runHousekeeping } from "@/modules/housekeeping/server";
import { addDays, todayUtc, toIsoDate } from "@/utils/dates";
import { createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import { adminPlanInput } from "../schemas";
import { setPlanAsAdmin } from "../server/admin-plan-service";

// A platform admin sets a place's plan by hand: until a last day (then housekeeping puts it back on Free), or with
// no end. A place paying by card is refused, since its plan follows Stripe.

const businessOf = (id: string) => prisma.business.findUniqueOrThrow({ where: { id } });
const plan = (fields: Record<string, unknown>) => adminPlanInput.parse(fields);

describe("an admin changing a place's plan", () => {
  it("sets a paid plan to the end of its last day, logs it, and housekeeping ends it", async () => {
    const admin = await createPlatformAdmin();
    const place = await createPlace();
    const lastDay = toIsoDate(addDays(todayUtc(new Date()), 10));

    const { renewsAt } = await setPlanAsAdmin(admin, place.business.id, plan({ plan: "BUSINESS", lastDay }));
    expect(toIsoDate(renewsAt!)).toBe(toIsoDate(addDays(todayUtc(new Date()), 11)));
    expect(await businessOf(place.business.id)).toMatchObject({ plan: "BUSINESS", planRenewsAt: renewsAt });
    expect(
      await prisma.auditLog.count({
        where: { entityId: place.business.id, action: "business.plan_changed", actorId: admin.userId },
      }),
    ).toBe(1);

    await runHousekeeping(addDays(renewsAt!, 1));
    expect(await businessOf(place.business.id)).toMatchObject({ plan: "FREE", planRenewsAt: null });
  });

  it("keeps a plan with no end through housekeeping, and Free has no end", async () => {
    const admin = await createPlatformAdmin();
    const place = await createPlace();
    await setPlanAsAdmin(admin, place.business.id, plan({ plan: "PRO" }));
    await runHousekeeping(addDays(new Date(), 400));
    expect(await businessOf(place.business.id)).toMatchObject({ plan: "PRO", planRenewsAt: null });

    expect(adminPlanInput.safeParse({ plan: "FREE", lastDay: "2030-01-01" }).success).toBe(false);
    await setPlanAsAdmin(admin, place.business.id, plan({ plan: "FREE" }));
    expect((await businessOf(place.business.id)).plan).toBe("FREE");
  });

  it("refuses a place paying by card, a past last day, and a place that does not exist", async () => {
    const admin = await createPlatformAdmin();
    const byCard = await createPlace();
    await prisma.business.update({
      where: { id: byCard.business.id },
      data: { plan: "PRO", stripeSubscriptionId: `sub_${randomUUID()}` },
    });
    await expect(setPlanAsAdmin(admin, byCard.business.id, plan({ plan: "BUSINESS" }))).rejects.toMatchObject(
      {
        code: "CONFLICT",
      },
    );
    expect((await businessOf(byCard.business.id)).plan).toBe("PRO");

    const place = await createPlace();
    await expect(
      setPlanAsAdmin(admin, place.business.id, plan({ plan: "PRO", lastDay: "2020-01-01" })),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setPlanAsAdmin(admin, "missing", plan({ plan: "PRO" }))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
