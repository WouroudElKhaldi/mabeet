import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { resolveContext } from "@/server/auth/resolve-context";
import { createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import {
  getPlatformHost,
  getPublicPlace,
  listPlatformBusinesses,
  listPlatformHosts,
  setBusinessStatus,
} from "../server";

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

describe("the admin's hosts table", () => {
  it("finds a host by their name, email or place, filters by their places' status and plan, and pages", async () => {
    const admin = await createPlatformAdmin();
    const word = randomUUID().slice(0, 8);
    const first = await createPlace(`Beit ${word} One`);
    const second = await createPlace(`Dar ${word} Two`);
    await prisma.business.update({
      where: { id: second.business.id },
      data: { plan: "PRO", status: "SUSPENDED" },
    });
    const ids = async (filters: Parameters<typeof listPlatformHosts>[1], page = 1) =>
      (await listPlatformHosts(admin, filters, page)).hosts.map((host) => host.id);

    expect(new Set(await ids({ q: word }))).toEqual(new Set([first.owner.id, second.owner.id]));
    expect(await ids({ q: first.owner.email.toUpperCase() })).toEqual([first.owner.id]);
    expect(await ids({ q: word, plan: "PRO" })).toEqual([second.owner.id]);
    expect(await ids({ q: word, status: "ACTIVE" })).toEqual([first.owner.id]);
    // Someone with no place is not a host, whatever their name.
    expect(await ids({ q: admin.userId })).toEqual([]);

    const one = await listPlatformHosts(admin, { q: word }, 1);
    expect(one).toMatchObject({ total: 2, page: 1, pages: 1 });
    expect(one.hosts.find((host) => host.id === second.owner.id)?.places).toEqual([
      expect.objectContaining({ id: second.business.id, plan: "PRO", status: "SUSPENDED" }),
    ]);
    // A page past the end shows the last one.
    expect((await listPlatformHosts(admin, { q: word }, 9)).page).toBe(1);
  });
});
