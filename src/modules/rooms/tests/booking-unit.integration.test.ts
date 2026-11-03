import { describe, expect, it } from "vitest";
import * as bookingUnitRoute from "@/app/api/workspaces/[businessId]/booking-unit/route";
import { addRoom, createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { chooseBookingUnit, createRoom } from "../server";

// Booking a place room by room, or as a whole: the whole place gets its one unit, started from its rooms added up,
// which takes turns with the rooms; it is never doubled and never uses up the plan's rooms.

const room = {
  name: "Room",
  capacity: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  minNights: 1,
  amenities: [],
  active: true,
};

describe("choosing how the place is booked", () => {
  it("gives a place booked whole its unit from its rooms added up, once, and keeps it when going back to rooms", async () => {
    const place = await createPlace("Beit Zaatar");
    await addRoom(place.business.id, { capacity: 2, baseRateCents: 9_000 });
    await addRoom(place.business.id, { capacity: 3, baseRateCents: 11_000 });

    const whole = await chooseBookingUnit(place.ctx, "WHOLE_PLACE");
    expect(whole.bookingUnit).toBe("WHOLE_PLACE");
    const unit = await prisma.room.findUniqueOrThrow({ where: { id: whole.wholePlaceUnitId ?? "" } });
    expect(unit).toMatchObject({
      kind: "WHOLE_PLACE",
      name: "Beit Zaatar",
      capacity: 5,
      baseRateCents: 20_000,
    });
    expect(await prisma.business.findUniqueOrThrow({ where: { id: place.business.id } })).toMatchObject({
      bookingUnit: "WHOLE_PLACE",
    });

    expect(await chooseBookingUnit(place.ctx, "ROOMS")).toEqual({
      bookingUnit: "ROOMS",
      wholePlaceUnitId: null,
    });
    expect((await chooseBookingUnit(place.ctx, "WHOLE_PLACE")).wholePlaceUnitId).toBe(unit.id);
    expect(await prisma.room.count({ where: { businessId: place.business.id, kind: "WHOLE_PLACE" } })).toBe(
      1,
    );
  });

  it("brings back a whole-place unit that was deleted, instead of making a second one", async () => {
    const place = await createPlace();
    const first = await chooseBookingUnit(place.ctx, "WHOLE_PLACE");
    await prisma.room.update({
      where: { id: first.wholePlaceUnitId ?? "" },
      data: { isDeleted: true, active: false },
    });
    const again = await chooseBookingUnit(place.ctx, "WHOLE_PLACE");
    expect(again.wholePlaceUnitId).toBe(first.wholePlaceUnitId);
    expect(
      await prisma.room.findUniqueOrThrow({ where: { id: again.wholePlaceUnitId ?? "" } }),
    ).toMatchObject({
      isDeleted: false,
      active: true,
    });
  });

  it("does not count the whole-place unit against the plan's rooms", async () => {
    const place = await createPlace();
    // The free plan allows three rooms.
    await createRoom(place.ctx, { ...room, baseRateCents: 8_000 });
    await createRoom(place.ctx, { ...room, baseRateCents: 8_000 });
    await chooseBookingUnit(place.ctx, "WHOLE_PLACE");
    await expect(createRoom(place.ctx, { ...room, baseRateCents: 8_000 })).resolves.toMatchObject({
      kind: "ROOM",
    });
    await expect(createRoom(place.ctx, { ...room, baseRateCents: 8_000 })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("needs both settings.manage and rooms.manage", async () => {
    const place = await createPlace();
    const settingsOnly = await memberWith(place.business.id, ["settings.manage"]);
    const roomsOnly = await memberWith(place.business.id, ["rooms.manage"]);
    await expect(chooseBookingUnit(settingsOnly, "WHOLE_PLACE")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(chooseBookingUnit(roomsOnly, "WHOLE_PLACE")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await prisma.room.count({ where: { businessId: place.business.id } })).toBe(0);
  });

  it("answers through PUT /api/workspaces/{businessId}/booking-unit, and 400 for an unknown unit", async () => {
    const place = await createPlace();
    const owner = await signUp("Owner");
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { businessId: place.business.id, isOwner: true },
    });
    await prisma.membership.create({
      data: { userId: owner.userId, businessId: place.business.id, roleId: ownerRole.id },
    });
    const params = { businessId: place.business.id };
    const put = (body: unknown) => call(bookingUnitRoute.PUT, { as: owner, method: "POST", params, body });
    expect(await put({ bookingUnit: "WHOLE_PLACE" })).toMatchObject({
      status: 200,
      body: { bookingUnit: "WHOLE_PLACE" },
    });
    expect((await put({ bookingUnit: "TENT" })).status).toBe(400);
  });
});
