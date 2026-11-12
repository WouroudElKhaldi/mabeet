import { describe, expect, it } from "vitest";
import * as archiveRoute from "@/app/api/workspaces/[businessId]/archive/route";
import { resolveContext } from "@/server/auth/resolve-context";
import { createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { getPublicPlace, setPlaceArchived } from "../server";

// An owner archives their own place: guests no longer see it, its team keeps the dashboard, and the owner brings it
// back. Only the business's owners decide, and a place the admin suspended stays suspended.

const statusOf = async (businessId: string) =>
  (await prisma.business.findUniqueOrThrow({ where: { id: businessId } })).status;

describe("archiving a place", () => {
  it("closes it to guests, keeps it for the team, and brings it back", async () => {
    const place = await createPlace("Beit Archive");

    await setPlaceArchived(place.ctx, true);
    expect(await statusOf(place.business.id)).toBe("ARCHIVED");
    expect(await getPublicPlace(place.business.slug)).toBeNull();
    expect(await resolveContext(place.owner.id, place.business.id)).not.toBeNull();
    const log = await prisma.auditLog.findFirst({
      where: { businessId: place.business.id, action: "business.archived" },
    });
    expect(log).toMatchObject({ entity: "business", actorId: place.owner.id });

    await setPlaceArchived(place.ctx, false);
    expect(await statusOf(place.business.id)).toBe("ACTIVE");
    expect(await getPublicPlace(place.business.slug)).not.toBeNull();
  });

  it("refuses a member who is not an owner, and archiving twice", async () => {
    const place = await createPlace("Beit Staff");
    const manager = await memberWith(place.business.id, ["settings.manage"]);
    await expect(setPlaceArchived(manager, true)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await setPlaceArchived(place.ctx, true);
    await expect(setPlaceArchived(place.ctx, true)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("never lets an owner reopen a place the admin suspended", async () => {
    const place = await createPlace("Beit Suspended");
    await prisma.business.update({ where: { id: place.business.id }, data: { status: "SUSPENDED" } });
    await expect(setPlaceArchived(place.ctx, false)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(setPlaceArchived(place.ctx, true)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await statusOf(place.business.id)).toBe("SUSPENDED");
  });

  it("answers the owner through its route, and a stranger gets not found", async () => {
    const place = await createPlace("Beit Route");
    const role = await prisma.role.findFirstOrThrow({
      where: { businessId: place.business.id, isOwner: true },
    });
    const owner = await signUp("Route Owner");
    await prisma.membership.create({
      data: { userId: owner.userId, businessId: place.business.id, roleId: role.id },
    });
    const stranger = await signUp("Stranger");
    const params = { businessId: place.business.id };

    const archived = await call(archiveRoute.PUT, {
      params,
      method: "PUT",
      body: { archived: true },
      as: owner,
    });
    expect(archived.status).toBe(200);
    expect(await statusOf(place.business.id)).toBe("ARCHIVED");
    const refused = await call(archiveRoute.PUT, {
      params,
      method: "PUT",
      body: { archived: false },
      as: stranger,
    });
    expect(refused.status).toBe(404);
    expect(await statusOf(place.business.id)).toBe("ARCHIVED");
  });
});
