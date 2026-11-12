import { describe, expect, it } from "vitest";
import * as featuredItem from "@/app/api/admin/featured-places/[sponsorshipId]/route";
import * as featuredList from "@/app/api/admin/featured-places/route";
import { searchPlaces } from "@/modules/directory/server";
import { addDays, todayUtc, toIsoDate } from "@/utils/dates";
import { addRoom, createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { endPlaceFeature, featurePlace, listFeaturedPlacesForAdmin } from "../server";

// Featured guesthouses on the real database: only platform admins feature a place and every change is logged; a
// featured place comes first in search, always marked, only on its days. The test database keeps every earlier
// run's places, so each search looks for a town of its own.

const today = () => toIsoDate(todayUtc());
const daysFromToday = (days: number) => toIsoDate(addDays(todayUtc(), days));

/** A listed place with a room in a town nobody else uses, so a search for that town finds only this run's places. */
async function listedPlace(name: string, town: string) {
  const place = await createPlace(name);
  await prisma.business.update({
    where: { id: place.business.id },
    data: { listedPublicly: true, area: town, currency: "USD" },
  });
  await addRoom(place.business.id);
  return place;
}

const ownTown = () => `Town ${crypto.randomUUID().slice(0, 8)}`;

describe("featuring a guesthouse", () => {
  it("puts it first in search, marked, and ends when the admin ends it", async () => {
    const admin = await createPlatformAdmin();
    const town = ownTown();
    const plain = await listedPlace("Beit Plain", town);
    const featured = await listedPlace("Beit Featured", town);
    const search = () => searchPlaces({ area: town, guests: 1, limit: 10 });

    const { id } = await featurePlace(admin, {
      businessId: featured.business.id,
      startsOn: today(),
      endsOn: daysFromToday(2),
    });

    expect((await search()).map((card) => [card.slug, card.featured])).toEqual([
      [featured.business.slug, true],
      [plain.business.slug, false],
    ]);
    expect(await listFeaturedPlacesForAdmin(admin)).toContainEqual(
      expect.objectContaining({
        id,
        placeName: "Beit Featured",
        startsOn: today(),
        endsOn: daysFromToday(2),
      }),
    );
    expect(
      await prisma.auditLog.findFirst({
        where: { entityId: id },
        select: { action: true, businessId: true },
      }),
    ).toEqual({ action: "place.featured", businessId: featured.business.id });

    await endPlaceFeature(admin, id);
    expect((await search()).every((card) => !card.featured)).toBe(true);
    expect((await listFeaturedPlacesForAdmin(admin)).map((days) => days.id)).not.toContain(id);
  });

  it("is not first before its first day", async () => {
    const admin = await createPlatformAdmin();
    const town = ownTown();
    await listedPlace("Beit Later", town);
    const later = await listedPlace("Beit Later Featured", town);

    await featurePlace(admin, {
      businessId: later.business.id,
      startsOn: daysFromToday(3),
      endsOn: daysFromToday(5),
    });

    expect((await searchPlaces({ area: town, guests: 1, limit: 10 })).every((card) => !card.featured)).toBe(
      true,
    );
  });

  it("refuses days already over, and a place that is closed or unknown", async () => {
    const admin = await createPlatformAdmin();
    const place = await listedPlace("Beit Closed", ownTown());

    await expect(
      featurePlace(admin, { businessId: place.business.id, startsOn: daysFromToday(-5), endsOn: today() }),
    ).rejects.toMatchObject({ status: 400 });
    await prisma.business.update({ where: { id: place.business.id }, data: { status: "SUSPENDED" } });
    await expect(
      featurePlace(admin, { businessId: place.business.id, startsOn: today(), endsOn: daysFromToday(1) }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      featurePlace(admin, { businessId: "no-such-place", startsOn: today(), endsOn: daysFromToday(1) }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("is for one thing only: the database refuses a sponsorship of a place and a partner at once", async () => {
    const admin = await createPlatformAdmin();
    const place = await listedPlace("Beit Two", ownTown());
    const partner = await prisma.partnerPlace.create({
      data: { name: "Cafe", kind: "CAFE", region: "north" },
    });

    await expect(
      prisma.sponsorship.create({
        data: {
          businessId: place.business.id,
          partnerPlaceId: partner.id,
          startsOn: todayUtc(),
          endsOn: addDays(todayUtc(), 1),
          createdById: admin.userId,
        },
      }),
    ).rejects.toThrow(/sponsorship_one_target/);
  });
});

describe("the featured places routes", () => {
  it("are for platform admins only", async () => {
    const place = await listedPlace("Beit Routes", ownTown());
    const host = await signUp("Host");
    const body = { businessId: place.business.id, startsOn: today(), endsOn: daysFromToday(1) };

    expect((await call(featuredList.GET, { as: host })).status).toBe(404);
    expect((await call(featuredList.POST, { as: host, body })).status).toBe(404);
    expect(
      (await call(featuredItem.DELETE, { as: host, method: "DELETE", params: { sponsorshipId: "anything" } }))
        .status,
    ).toBe(404);
    expect(await prisma.sponsorship.count({ where: { businessId: place.business.id } })).toBe(0);
  });
});
