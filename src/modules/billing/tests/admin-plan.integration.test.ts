import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWorkspace } from "@/modules/workspaces/server";
import { runHousekeeping } from "@/modules/housekeeping/server";
import { addDays, todayUtc, toIsoDate } from "@/utils/dates";
import { createPlace, createPlatformAdmin, prisma, putHostOnPlan } from "@tests/integration/helpers";
import { adminPlanInput } from "../schemas";
import { setPlanAsAdmin } from "../server/admin-plan-service";

// A platform admin sets a host's plan by hand, for all their places: until a last day (then housekeeping puts them
// back on Free), or with no end. A host paying by card is refused, since their plan follows Stripe.

const planOf = (userId: string) => prisma.hostPlan.findUniqueOrThrow({ where: { userId } });
const plan = (fields: Record<string, unknown>) => adminPlanInput.parse(fields);

describe("an admin changing a host's plan", () => {
  it("sets a paid plan to the end of its last day, logs it, and housekeeping ends it", async () => {
    const admin = await createPlatformAdmin();
    const place = await createPlace();
    const lastDay = toIsoDate(addDays(todayUtc(new Date()), 10));

    const { renewsAt } = await setPlanAsAdmin(admin, place.owner.id, plan({ plan: "BUSINESS", lastDay }));
    expect(toIsoDate(renewsAt!)).toBe(toIsoDate(addDays(todayUtc(new Date()), 11)));
    expect(await planOf(place.owner.id)).toMatchObject({ plan: "BUSINESS", planRenewsAt: renewsAt });
    expect(
      await prisma.auditLog.count({
        where: { entityId: place.owner.id, action: "host.plan_changed", actorId: admin.userId },
      }),
    ).toBe(1);

    await runHousekeeping(addDays(renewsAt!, 1));
    expect(await planOf(place.owner.id)).toMatchObject({ plan: "FREE", planRenewsAt: null });
  });

  it("covers every place the host has", async () => {
    const admin = await createPlatformAdmin();
    const place = await createPlace();
    const second = await createWorkspace(place.owner.id, { name: `Dar ${randomUUID().slice(0, 6)}` });
    await setPlanAsAdmin(admin, place.owner.id, plan({ plan: "PRO" }));

    expect(await prisma.business.count({ where: { id: second.id, hostId: place.owner.id } })).toBe(1);
    expect((await planOf(place.owner.id)).plan).toBe("PRO");
  });

  it("keeps a plan with no end through housekeeping, and Free has no end", async () => {
    const admin = await createPlatformAdmin();
    const place = await createPlace();
    await setPlanAsAdmin(admin, place.owner.id, plan({ plan: "PRO" }));
    await runHousekeeping(addDays(new Date(), 400));
    expect(await planOf(place.owner.id)).toMatchObject({ plan: "PRO", planRenewsAt: null });

    expect(adminPlanInput.safeParse({ plan: "FREE", lastDay: "2030-01-01" }).success).toBe(false);
    await setPlanAsAdmin(admin, place.owner.id, plan({ plan: "FREE" }));
    expect((await planOf(place.owner.id)).plan).toBe("FREE");
  });

  it("refuses a host paying by card, a past last day, and someone who hosts nothing", async () => {
    const admin = await createPlatformAdmin();
    const byCard = await createPlace();
    await putHostOnPlan(byCard.owner.id, "PRO");
    await prisma.hostPlan.update({
      where: { userId: byCard.owner.id },
      data: { stripeSubscriptionId: `sub_${randomUUID()}` },
    });
    await expect(setPlanAsAdmin(admin, byCard.owner.id, plan({ plan: "BUSINESS" }))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect((await planOf(byCard.owner.id)).plan).toBe("PRO");

    const place = await createPlace();
    await expect(
      setPlanAsAdmin(admin, place.owner.id, plan({ plan: "PRO", lastDay: "2020-01-01" })),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setPlanAsAdmin(admin, admin.userId, plan({ plan: "PRO" }))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
