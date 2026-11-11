import { afterEach, describe, expect, it } from "vitest";
import * as partnerItem from "@/app/api/admin/partners/[partnerId]/route";
import * as partnerList from "@/app/api/admin/partners/route";
import * as sponsorships from "@/app/api/admin/partners/[partnerId]/sponsorships/route";
import { getPlace } from "@/modules/directory/server";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { addDays, toIsoDate } from "@/utils/dates";
import { createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import {
  createPartner,
  endSponsorship,
  listNearbyPartners,
  listPartnerPage,
  listPartnersForAdmin,
  removePartner,
  restorePartner,
  sponsorPartner,
  updatePartner,
} from "../server";

// Featured partners on the real database: only platform admins manage them and every change is logged; guests see
// the partners of the region they stay in, sponsored ones first only inside their dates and always marked; a removed
// partner disappears and can be brought back. The test database keeps every earlier run's partners, so each test
// works around its own map pin and on its own far-off day, where nothing else is near or sponsored.

afterEach(() => resetMemoryRateLimits());

/** A spot of its own, and a day of its own: no other run's partner is this close, or sponsored on this day. */
function ownSpotAndDay() {
  const pin = { latitude: 33 + Math.random(), longitude: 35 + Math.random() };
  const now = new Date(Date.UTC(2090, 0, 1) + Math.floor(Math.random() * 20_000) * 86_400_000);
  return { pin, now, place: { region: "north", ...pin } };
}

const partner = (name: string, pin: { latitude: number; longitude: number }, step = 0) => ({
  name,
  kind: "RESTAURANT" as const,
  region: "north" as const,
  area: "Batroun",
  latitude: pin.latitude + step,
  longitude: pin.longitude,
  photoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4",
  websiteUrl: "https://example.com",
  phone: "+96170123456",
});

const ids = (list: Array<{ id: string }>) => list.map((item) => item.id);

describe("managing partners", () => {
  it("lets only platform admins add or change partners, through the routes", async () => {
    const body = partner("Chez Maguy", { latitude: 34.25, longitude: 35.65 });
    expect((await call(partnerList.POST, { body })).status).toBe(401);
    // Anyone else is told there is nothing here, as everywhere in the admin area.
    const host = await signUp("A host");
    expect((await call(partnerList.POST, { as: host, body })).status).toBe(404);
    expect((await call(partnerList.GET, { as: host })).status).toBe(404);

    const admin = await signUp("An admin");
    await prisma.user.update({ where: { id: admin.userId }, data: { platformRole: "SUPER_ADMIN" } });
    const created = await call(partnerList.POST, { as: admin, body });
    expect(created.status).toBe(201);
    const { id } = created.body as { id: string };
    const changed = await call(partnerItem.PATCH, {
      as: host,
      method: "PATCH",
      params: { partnerId: id },
      body,
    });
    expect(changed.status).toBe(404);
    expect(
      (await call(partnerItem.PATCH, { as: admin, method: "PATCH", params: { partnerId: id }, body })).status,
    ).toBe(200);
  });

  it("refuses wrong fields and names them: a plain-http link, half a map pin, an unknown region", async () => {
    const admin = await signUp("An admin");
    await prisma.user.update({ where: { id: admin.userId }, data: { platformRole: "SUPER_ADMIN" } });
    const good = partner("Souk el Tayeb", { latitude: 33.9, longitude: 35.5 });
    for (const [field, body] of [
      ["websiteUrl", { ...good, websiteUrl: "http://example.com" }],
      ["longitude", { ...good, longitude: null }],
      ["region", { ...good, region: "atlantis" }],
      ["kind", { ...good, kind: "CASINO" }],
    ] as const) {
      const response = await call(partnerList.POST, { as: admin, body });
      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain(field);
    }
  });

  it("logs every change under the admin's name", async () => {
    const admin = await createPlatformAdmin();
    const { pin, now } = ownSpotAndDay();
    const { id } = await createPartner(admin, partner("Taverne", pin));
    await updatePartner(admin, id, { ...partner("Taverne du port", pin) });
    const { id: sponsorshipId } = await sponsorPartner(
      admin,
      id,
      { startsOn: toIsoDate(now), endsOn: toIsoDate(addDays(now, 3)) },
      now,
    );
    await endSponsorship(admin, id, sponsorshipId);
    await removePartner(admin, id);
    await restorePartner(admin, id);
    const log = await prisma.auditLog.findMany({
      where: { entity: "partner", entityId: id },
      orderBy: { createdAt: "asc" },
      select: { action: true, actorId: true },
    });
    expect(log.map((entry) => entry.action)).toEqual([
      "partner.created",
      "partner.updated",
      "partner.sponsored",
      "partner.sponsorship_ended",
      "partner.removed",
      "partner.restored",
    ]);
    expect(new Set(log.map((entry) => entry.actorId))).toEqual(new Set([admin.userId]));
  });
});

describe("partners near a stay", () => {
  it("shows the region's partners nearest first, never another region's or a removed one", async () => {
    const admin = await createPlatformAdmin();
    const { pin, now, place } = ownSpotAndDay();
    const near = await createPartner(admin, partner("Near", pin, 0.001));
    const far = await createPartner(admin, partner("Farther", pin, 0.01));
    const south = await createPartner(admin, { ...partner("Elsewhere", pin), region: "south" });

    const nearby = await listNearbyPartners(place, now);
    expect(ids(nearby).slice(0, 2)).toEqual([near.id, far.id]);
    expect(ids(nearby)).not.toContain(south.id);
    expect(nearby[0]).toMatchObject({ sponsored: false, distanceKm: 0.1 });

    await removePartner(admin, near.id);
    expect(ids(await listNearbyPartners(place, now))).not.toContain(near.id);
    expect((await listPartnersForAdmin(admin)).find((row) => row.id === near.id)).toMatchObject({
      isDeleted: true,
    });
    await restorePartner(admin, near.id);
    expect(ids(await listNearbyPartners(place, now))[0]).toBe(near.id);
    await expect(restorePartner(admin, near.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("puts a sponsored partner first only inside its days, and always marks it", async () => {
    const admin = await createPlatformAdmin();
    const { pin, now, place } = ownSpotAndDay();
    const near = await createPartner(admin, partner("Near", pin, 0.001));
    const sponsored = await createPartner(admin, partner("Sponsored but farther", pin, 0.02));
    const { id: sponsorshipId } = await sponsorPartner(
      admin,
      sponsored.id,
      { startsOn: toIsoDate(addDays(now, 1)), endsOn: toIsoDate(addDays(now, 3)) },
      now,
    );

    // Not yet: the sponsorship starts tomorrow.
    expect(ids(await listNearbyPartners(place, now)).slice(0, 2)).toEqual([near.id, sponsored.id]);
    // Its first and last day: first, and marked.
    for (const day of [addDays(now, 1), addDays(now, 2)]) {
      const nearby = await listNearbyPartners(place, day);
      expect(nearby[0]).toMatchObject({ id: sponsored.id, sponsored: true });
      expect(nearby.filter((item) => item.sponsored).map((item) => item.id)).toEqual([sponsored.id]);
    }
    // The day it ends (endsOn): back in its place, unmarked.
    expect((await listNearbyPartners(place, addDays(now, 3)))[0]).toMatchObject({
      id: near.id,
      sponsored: false,
    });

    await endSponsorship(admin, sponsored.id, sponsorshipId);
    expect((await listNearbyPartners(place, addDays(now, 1)))[0]?.id).toBe(near.id);
  });

  it("refuses sponsoring days that are over, a removed partner, or another partner's sponsorship", async () => {
    const admin = await createPlatformAdmin();
    const { pin, now } = ownSpotAndDay();
    const one = await createPartner(admin, partner("One", pin));
    const other = await createPartner(admin, partner("Other", pin));
    const past = { startsOn: toIsoDate(addDays(now, -5)), endsOn: toIsoDate(now) };
    await expect(sponsorPartner(admin, one.id, past, now)).rejects.toMatchObject({ code: "VALIDATION" });

    const { id } = await sponsorPartner(
      admin,
      one.id,
      { startsOn: toIsoDate(now), endsOn: toIsoDate(addDays(now, 1)) },
      now,
    );
    await expect(endSponsorship(admin, other.id, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await removePartner(admin, other.id);
    await expect(
      sponsorPartner(admin, other.id, { startsOn: toIsoDate(now), endsOn: toIsoDate(addDays(now, 1)) }, now),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sponsors through the route with the last day after the first, and the database refuses a sponsorship of nothing", async () => {
    const admin = await signUp("An admin");
    await prisma.user.update({ where: { id: admin.userId }, data: { platformRole: "SUPER_ADMIN" } });
    const { pin } = ownSpotAndDay();
    const { id } = (await call(partnerList.POST, { as: admin, body: partner("Route sponsor", pin) }))
      .body as {
      id: string;
    };
    const backwards = await call(sponsorships.POST, {
      as: admin,
      params: { partnerId: id },
      body: { startsOn: "2099-05-10", endsOn: "2099-05-10" },
    });
    expect(backwards.status).toBe(400);

    await expect(
      prisma.sponsorship.create({
        data: { startsOn: new Date("2099-05-10"), endsOn: new Date("2099-05-11"), createdById: admin.userId },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.sponsorship.create({
        data: {
          partnerPlaceId: id,
          startsOn: new Date("2099-05-10"),
          endsOn: new Date("2099-05-09"),
          createdById: admin.userId,
        },
      }),
    ).rejects.toThrow();
  });

  it("is on a place's public page, and a place with no region has none", async () => {
    const admin = await createPlatformAdmin();
    const { pin } = ownSpotAndDay();
    const { business } = await createPlace("Beit Partners");
    await prisma.business.update({ where: { id: business.id }, data: { region: "north", ...pin } });
    const { id } = await createPartner(admin, partner("Next door", pin, 0.001));
    expect((await getPlace(business.slug))?.nearby[0]).toMatchObject({
      id,
      name: "Next door",
      sponsored: false,
    });

    expect(await listNearbyPartners({ region: null, ...pin })).toEqual([]);
  });
});

describe("the admin's partners table", () => {
  it("finds partners by name or town, filters by kind and region, and shows the removed ones apart", async () => {
    const admin = await createPlatformAdmin();
    const word = `Zx${Math.random().toString(36).slice(2, 8)}`;
    const { pin } = ownSpotAndDay();
    const kept = await createPartner(admin, { ...partner(`Cafe ${word}`, pin), kind: "CAFE" });
    const gone = await createPartner(admin, { ...partner(`Grill ${word}`, pin, 0.01), region: "south" });
    await removePartner(admin, gone.id);

    const names = async (filters: Partial<Parameters<typeof listPartnerPage>[1]>) =>
      (await listPartnerPage(admin, { q: word, removed: false, ...filters })).partners.map((row) => row.id);
    expect(await names({})).toEqual([kept.id]);
    expect(await names({ removed: true })).toEqual([gone.id]);
    expect(await names({ kind: "RESTAURANT" })).toEqual([]);
    expect(await names({ region: "north", kind: "CAFE" })).toEqual([kept.id]);
    expect(await names({ q: word.toUpperCase(), region: "south", removed: true })).toEqual([gone.id]);
    expect(await listPartnerPage(admin, { q: word, removed: false }, 3)).toMatchObject({
      total: 1,
      page: 1,
      pages: 1,
    });
  });
});
