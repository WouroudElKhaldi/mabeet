import { describe, expect, it } from "vitest";
import * as settingsRoute from "@/app/api/workspaces/[businessId]/settings/route";
import { createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { getSettings, updateSettings } from "../server";

// The place's settings: only the fields sent change, the region follows the town, and how guests book and pay is the
// owner's choice, with full refunds accepted before any online mode.

async function ownerOf(businessId: string) {
  const owner = await signUp("Owner");
  const role = await prisma.role.findFirstOrThrow({ where: { businessId, isOwner: true } });
  await prisma.membership.create({ data: { userId: owner.userId, businessId, roleId: role.id } });
  return owner;
}

describe("the place's settings", () => {
  it("changes only the fields sent, and finds the region from the town", async () => {
    const place = await createPlace("Beit Ehden");
    const saved = await updateSettings(place.ctx, {
      whatsapp: "+96171123456",
      area: "Ehden",
      description: null,
      checkInTime: "15:00",
      tags: ["mountain-view", "quiet"],
    });
    expect(saved).toMatchObject({
      name: "Beit Ehden",
      whatsapp: "+96171123456",
      area: "Ehden",
      region: "north",
      description: null,
      checkInTime: "15:00",
      checkOutTime: "11:00",
      tags: ["mountain-view", "quiet"],
    });
    // The host's own pick of region wins over the town.
    expect(await updateSettings(place.ctx, { region: "mount-lebanon" })).toMatchObject({
      region: "mount-lebanon",
    });
    expect(
      await prisma.auditLog.count({ where: { entityId: place.business.id, action: "settings.updated" } }),
    ).toBe(2);
  });

  it("refuses an online mode until the owner accepts full refunds, then remembers it", async () => {
    const place = await createPlace();
    const now = new Date("2026-11-03T09:00:00Z");
    await expect(updateSettings(place.ctx, { bookingMode: "AUTOMATIC" }, now)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(await getSettings(place.ctx)).toMatchObject({
      bookingMode: "OFFLINE",
      onlineTermsAcceptedAt: null,
    });

    const online = await updateSettings(
      place.ctx,
      { bookingMode: "ONLINE_APPROVAL", acceptOnlineTerms: true },
      now,
    );
    expect(online).toMatchObject({ bookingMode: "ONLINE_APPROVAL", onlineTermsAcceptedAt: now });
    // Accepted once is enough: going offline and back online needs no second acceptance.
    await updateSettings(place.ctx, { bookingMode: "OFFLINE" });
    expect(await updateSettings(place.ctx, { bookingMode: "AUTOMATIC" })).toMatchObject({
      bookingMode: "AUTOMATIC",
      onlineTermsAcceptedAt: now,
    });
  });

  it("lets a member with settings.manage edit the place, but only an owner choose how guests book and pay", async () => {
    const place = await createPlace();
    const editor = await memberWith(place.business.id, ["settings.manage"]);
    await expect(updateSettings(editor, { houseRules: "No parties" })).resolves.toMatchObject({
      houseRules: "No parties",
    });
    await expect(updateSettings(editor, { bookingMode: "OFFLINE" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(updateSettings(editor, { acceptOnlineTerms: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const frontDesk = await memberWith(place.business.id, ["bookings.read", "bookings.decide"]);
    await expect(getSettings(frontDesk)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("GET and PATCH /api/workspaces/{businessId}/settings", () => {
  it("reads and saves through the route, saves an emptied box as nothing, and names wrong input with 400", async () => {
    const place = await createPlace();
    const owner = await ownerOf(place.business.id);
    const params = { businessId: place.business.id };

    expect(await call(settingsRoute.GET, { as: owner, params })).toMatchObject({
      status: 200,
      body: { name: place.business.name, bookingMode: "OFFLINE" },
    });
    const saved = await call(settingsRoute.PATCH, {
      as: owner,
      method: "PATCH",
      params,
      body: { holdHours: 12, houseRules: "  " },
    });
    expect(saved).toMatchObject({ status: 200, body: { holdHours: 12, houseRules: null } });
    for (const body of [{ phone: "71123456" }, { tags: ["noisy"] }, { holdHours: 0 }, { currency: "GBP" }]) {
      expect((await call(settingsRoute.PATCH, { as: owner, method: "PATCH", params, body })).status).toBe(
        400,
      );
    }
  });

  it("answers 404 to someone outside the place and 401 to someone signed out", async () => {
    const place = await createPlace();
    const stranger = await signUp("Stranger");
    const params = { businessId: place.business.id };
    expect((await call(settingsRoute.GET, { as: stranger, params })).status).toBe(404);
    expect((await call(settingsRoute.GET, { params })).status).toBe(401);
  });
});
