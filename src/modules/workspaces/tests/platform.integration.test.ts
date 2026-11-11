import { describe, expect, it } from "vitest";
import { resolveContext } from "@/server/auth/resolve-context";
import { createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import { getPlatformHost, getPublicPlace, listPlatformBusinesses, setBusinessStatus } from "../server";

// A platform admin suspends a business: it disappears for guests and its team at once, comes back when reactivated,
// and both are logged under the admin's name. Nobody else can do it.

describe("suspending a business", () => {
  it("hides it everywhere and brings it back", async () => {
    const place = await createPlace();
    const admin = await createPlatformAdmin();
    await setBusinessStatus(admin, place.business.id, "SUSPENDED");
    expect(await getPublicPlace(place.business.slug)).toBeNull();
    expect(await resolveContext(place.owner.id, place.business.id)).toBeNull();

    await setBusinessStatus(admin, place.business.id, "ACTIVE");
    expect(await getPublicPlace(place.business.slug)).not.toBeNull();
    expect(
      await prisma.auditLog.count({
        where: {
          entityId: place.business.id,
          actorId: admin.userId,
          action: { in: ["business.suspended", "business.reactivated"] },
        },
      }),
    ).toBe(2);
  });

  it("lists the business with its owner, and answers not found for a business that does not exist", async () => {
    const place = await createPlace();
    const admin = await createPlatformAdmin();
    const { businesses } = await listPlatformBusinesses(admin);
    expect(businesses.find((business) => business.id === place.business.id)?.owners).toEqual([
      expect.objectContaining({ id: place.owner.id }),
    ]);
    await expect(setBusinessStatus(admin, "missing", "SUSPENDED")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("one host for the admin", () => {
  it("shows their businesses and their profile even when it is private, and 404 for someone who owns nothing", async () => {
    const place = await createPlace();
    await prisma.hostProfile.create({
      data: { userId: place.owner.id, city: "Batroun", languages: ["ar", "fr"], showOnListings: false },
    });
    const admin = await createPlatformAdmin();
    const host = await getPlatformHost(admin, place.owner.id);
    expect(host.profile).toMatchObject({ city: "Batroun", showOnListings: false });
    expect(host.businesses).toEqual([expect.objectContaining({ id: place.business.id, teamCount: 1 })]);
    await expect(getPlatformHost(admin, admin.userId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
