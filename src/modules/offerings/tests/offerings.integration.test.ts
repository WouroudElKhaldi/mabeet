import { describe, expect, it } from "vitest";
import * as offeringItem from "@/app/api/workspaces/[businessId]/offerings/[offeringId]/route";
import * as sessionsRoute from "@/app/api/workspaces/[businessId]/offerings/[offeringId]/sessions/route";
import * as offeringsRoute from "@/app/api/workspaces/[businessId]/offerings/route";
import * as workspaces from "@/app/api/workspaces/route";
import { addDays, toIsoDate, todayUtc } from "@/utils/dates";
import { createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { offeringInput } from "../schemas";
import { createOffering, listOfferings, scheduleSessions, updateOffering } from "../server";

// The team's catalogue of experiences and services: what they sell, within the plan, and when its sessions run.

/** What the host sends; the services take it as the route's check hands it over. */
const hikeBody = {
  kind: "EXPERIENCE",
  title: "Sunrise hike in the Qadisha valley",
  area: "Bcharre",
  durationMinutes: 180,
  priceCents: 3_500,
  priceUnit: "PER_PERSON",
  maxGuests: 8,
};
const hike = offeringInput.parse(hikeBody);

const inDays = (days: number) => toIsoDate(addDays(todayUtc(), days));

describe("experiences and services", () => {
  it("adds one with a unique link, works out its region from the town, and logs it", async () => {
    const place = await createPlace();
    const offering = await createOffering(place.ctx, offeringInput.parse({ ...hikeBody, description: "" }));
    expect(offering).toMatchObject({ businessId: place.business.id, region: "north", priceCents: 3_500 });
    expect(offering.description).toBeNull();
    expect(offering.slug).toMatch(/^sunrise-hike-in-the-qadisha-valley/);
    const log = await prisma.auditLog.findFirst({
      where: { entityId: offering.id, action: "offering.created" },
    });
    expect(log).not.toBeNull();
  });

  it("stops a Free place at one, and lets a Pro place add more", async () => {
    const place = await createPlace();
    await createOffering(place.ctx, hike);
    await expect(createOffering(place.ctx, hike)).rejects.toMatchObject({ code: "CONFLICT" });
    await prisma.business.update({ where: { id: place.business.id }, data: { plan: "PRO" } });
    const second = await createOffering(place.ctx, hike);
    expect(second.slug).not.toBe((await listOfferings(place.ctx))[1]?.slug);
  });

  it("files it only under a category of its own type", async () => {
    const place = await createPlace();
    const [experienceCategory, homeCategory] = await Promise.all([
      prisma.category.create({
        data: {
          slug: `hikes-${Date.now()}`,
          kind: "EXPERIENCE",
          nameEn: "Hikes",
          nameAr: "مشي",
          icon: "mountain",
        },
      }),
      prisma.category.create({
        data: { slug: `villas-${Date.now()}`, kind: "HOME", nameEn: "Villas", nameAr: "فلل", icon: "home" },
      }),
    ]);
    await expect(
      createOffering(place.ctx, { ...hike, categorySlug: homeCategory.slug }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const offering = await createOffering(place.ctx, { ...hike, categorySlug: experienceCategory.slug });
    await expect(updateOffering(place.ctx, offering.id, { kind: "SERVICE" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("changes only the fields sent, and a new town brings its region", async () => {
    const place = await createPlace();
    const offering = await createOffering(place.ctx, { ...hike, tags: ["hiking-nearby"] });
    const updated = await updateOffering(place.ctx, offering.id, { area: "Zahle", active: false });
    expect(updated).toMatchObject({ area: "Zahle", region: "bekaa", active: false, tags: ["hiking-nearby"] });
    expect(updated.title).toBe(hike.title);
  });

  it("schedules sessions at the local time where the business is, summer time or not, and only in the future", async () => {
    const place = await createPlace();
    const offering = await createOffering(place.ctx, hike);
    const sessions = await scheduleSessions(place.ctx, offering.id, {
      dates: ["2027-01-15", "2027-07-15", "2027-01-15"],
      time: "06:30",
      capacity: 12,
    });
    // Beirut is UTC+2 in winter and UTC+3 in summer; the same date twice makes one session.
    expect(sessions.map((session) => session.startsAt.toISOString())).toEqual([
      "2027-01-15T04:30:00.000Z",
      "2027-07-15T03:30:00.000Z",
    ]);
    expect(sessions[0]!.endsAt.getTime() - sessions[0]!.startsAt.getTime()).toBe(180 * 60_000);
    await expect(
      scheduleSessions(place.ctx, offering.id, { dates: [inDays(-1)], time: "10:00", capacity: 4 }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const listed = await listOfferings(place.ctx, new Date("2027-01-01T00:00:00Z"));
    expect(listed[0]!.sessions).toHaveLength(2);
  });

  it("needs offerings.manage", async () => {
    const place = await createPlace();
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    await expect(createOffering(staff, hike)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listOfferings(staff)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("offering routes", () => {
  it("check the body, and never reach another business's offerings", async () => {
    const owner = await signUp("Offering owner");
    const workspace = await call(workspaces.POST, { as: owner, body: { name: "Beit Routes" } });
    const { id: businessId } = workspace.body as { id: string };
    const other = await createPlace();
    const theirs = await createOffering(other.ctx, hike);

    expect(
      (
        await call(offeringsRoute.POST, {
          as: owner,
          params: { businessId },
          body: { ...hikeBody, priceCents: -1 },
        })
      ).status,
    ).toBe(400);
    const created = await call(offeringsRoute.POST, { as: owner, params: { businessId }, body: hikeBody });
    expect(created.status).toBe(201);
    const listed = await call(offeringsRoute.GET, { as: owner, params: { businessId } });
    expect(listed.body).toEqual([expect.objectContaining({ title: hike.title, sessions: [] })]);

    // Their offering through our workspace, or their workspace outright: both are "not found".
    const throughOurs = await call(offeringItem.PATCH, {
      as: owner,
      method: "PATCH",
      params: { businessId, offeringId: theirs.id },
      body: { title: "Not yours" },
    });
    expect(throughOurs.status).toBe(404);
    const intoTheirs = await call(sessionsRoute.POST, {
      as: owner,
      params: { businessId: other.business.id, offeringId: theirs.id },
      body: { dates: [inDays(5)], time: "10:00", capacity: 4 },
    });
    expect(intoTheirs.status).toBe(404);
    expect(await prisma.offering.findUniqueOrThrow({ where: { id: theirs.id } })).toMatchObject({
      title: hike.title,
    });
  });
});
