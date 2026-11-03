import { beforeEach, describe, expect, it } from "vitest";
import * as roomItem from "@/app/api/workspaces/[businessId]/rooms/[roomId]/route";
import * as roomList from "@/app/api/workspaces/[businessId]/rooms/route";
import { createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { createRoom, getRoom, listRooms, updateRoom } from "../server/room-service";

/** What a host must type; the rest has defaults. */
const cedarRoom = { name: "Cedar room", capacity: 2, baseRateCents: 8500 };
/** The defaults the route fills in, for calls straight to the service. */
const defaults = { bedrooms: 1, beds: 1, bathrooms: 1, minNights: 1, amenities: [], active: true };

describe("rooms", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;

  beforeEach(async () => {
    place = await createPlace();
  });

  it("lets the owner add a room and find it in the list", async () => {
    const room = await createRoom(place.ctx, { ...cedarRoom, ...defaults, amenities: ["wifi", "view"] });
    expect(room).toMatchObject({ ...cedarRoom, kind: "ROOM", amenities: ["wifi", "view"], active: true });
    expect((await listRooms(place.ctx)).map(({ id }) => id)).toEqual([room.id]);
  });

  it("gives every room its own calendar secret, and never returns it", async () => {
    const response = await call(roomList.POST, {
      as: await ownerOf(place.business.id),
      params: { businessId: place.business.id },
      body: cedarRoom,
    });
    expect(response.status).toBe(201);
    const { id } = response.body as { id: string };
    expect(response.body).not.toHaveProperty("exportToken");
    const saved = await prisma.room.findUniqueOrThrow({ where: { id } });
    expect(saved.exportToken.length).toBeGreaterThanOrEqual(40);
  });

  it("changes only what an edit sends", async () => {
    const owner = await ownerOf(place.business.id);
    const created = await call(roomList.POST, {
      as: owner,
      params: { businessId: place.business.id },
      body: { ...cedarRoom, amenities: ["wifi"], minNights: 2 },
    });
    const { id: roomId } = created.body as { id: string };
    const edited = await call(roomItem.PATCH, {
      as: owner,
      method: "PATCH",
      params: { businessId: place.business.id, roomId },
      body: { baseRateCents: 9500, active: false },
    });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      baseRateCents: 9500,
      active: false,
      amenities: ["wifi"],
      minNights: 2,
    });
  });

  it("keeps an LBP price above the 32-bit limit exact", async () => {
    // 4,500,000 LBP a night, in minor units.
    const room = await createRoom(place.ctx, { ...cedarRoom, ...defaults, baseRateCents: 450_000_000 });
    await updateRoom(place.ctx, room.id, { baseRateCents: 2_250_000_000 });
    expect((await getRoom(place.ctx, room.id)).baseRateCents).toBe(2_250_000_000);
  });

  it("answers 403 through the route to staff without rooms.manage, and saves nothing", async () => {
    const staff = await signUp("Front desk");
    const role = await prisma.role.findFirstOrThrow({
      where: { businessId: place.business.id, name: "Front desk" },
    });
    await prisma.membership.create({
      data: { userId: staff.userId, businessId: place.business.id, roleId: role.id },
    });

    const params = { businessId: place.business.id };
    expect((await call(roomList.POST, { as: staff, params, body: cedarRoom })).status).toBe(403);
    expect((await call(roomList.GET, { as: staff, params })).status).toBe(200);
    expect(await prisma.room.count({ where: { businessId: place.business.id } })).toBe(0);
  });

  it("refuses wrong input with 400", async () => {
    const owner = await ownerOf(place.business.id);
    const params = { businessId: place.business.id };
    const wrong = [
      { ...cedarRoom, capacity: 0 },
      { ...cedarRoom, baseRateCents: 85.5 },
      { ...cedarRoom, baseRateCents: -1 },
      { ...cedarRoom, amenities: ["helipad"] },
      { ...cedarRoom, amenities: ["wifi", "wifi"] },
      { ...cedarRoom, name: "   " },
    ];
    for (const body of wrong)
      expect((await call(roomList.POST, { as: owner, params, body })).status).toBe(400);
  });

  it("lets staff with rooms.read see rooms but not change them", async () => {
    const room = await createRoom(place.ctx, { ...cedarRoom, ...defaults });
    const reader = await memberWith(place.business.id, ["rooms.read"]);
    expect(await getRoom(reader, room.id)).toMatchObject({ id: room.id });
    await expect(updateRoom(reader, room.id, { name: "Renamed" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(createRoom(reader, { ...cedarRoom, ...defaults })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("stops at the plan's limit, and lets a bigger plan add more", async () => {
    // The Free plan allows 3 rooms.
    for (const name of ["Cedar", "Olive", "Pine"])
      await createRoom(place.ctx, { ...cedarRoom, ...defaults, name });
    await expect(createRoom(place.ctx, { ...cedarRoom, ...defaults, name: "Fig" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await prisma.room.count({ where: { businessId: place.business.id } })).toBe(3);

    await prisma.business.update({ where: { id: place.business.id }, data: { plan: "PRO" } });
    await expect(createRoom(place.ctx, { ...cedarRoom, ...defaults, name: "Fig" })).resolves.toBeDefined();
  });

  it("lets only one of several rooms added at the same moment take the plan's last place", async () => {
    // The Free plan allows 3 rooms: with 2 saved, four added at once must leave exactly 3.
    for (const name of ["Cedar", "Olive"]) await createRoom(place.ctx, { ...cedarRoom, ...defaults, name });
    const results = await Promise.allSettled(
      ["Pine", "Fig", "Oak", "Palm"].map((name) =>
        createRoom(place.ctx, { ...cedarRoom, ...defaults, name }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.room.count({ where: { businessId: place.business.id } })).toBe(3);
  });

  it("does not count a deleted room against the plan, nor show it", async () => {
    const deleted = await createRoom(place.ctx, { ...cedarRoom, ...defaults, name: "Cedar" });
    for (const name of ["Olive", "Pine"]) await createRoom(place.ctx, { ...cedarRoom, ...defaults, name });
    await prisma.room.update({ where: { id: deleted.id }, data: { isDeleted: true } });

    await expect(createRoom(place.ctx, { ...cedarRoom, ...defaults, name: "Fig" })).resolves.toBeDefined();
    expect((await listRooms(place.ctx)).map((room) => room.name)).toEqual(["Olive", "Pine", "Fig"]);
    await expect(getRoom(place.ctx, deleted.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateRoom(place.ctx, deleted.id, { name: "Back" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("answers 404 for another business's room, and leaves it unchanged", async () => {
    const other = await createPlace("Beit Other");
    const theirs = await createRoom(other.ctx, { ...cedarRoom, ...defaults });
    await expect(getRoom(place.ctx, theirs.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateRoom(place.ctx, theirs.id, { baseRateCents: 1 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await getRoom(other.ctx, theirs.id)).baseRateCents).toBe(cedarRoom.baseRateCents);
  });

  it("records each change in the business's audit log", async () => {
    const room = await createRoom(place.ctx, { ...cedarRoom, ...defaults });
    await updateRoom(place.ctx, room.id, { name: "Cedar suite" });
    const actions = await prisma.auditLog.findMany({
      where: { businessId: place.business.id, entityId: room.id },
      orderBy: { createdAt: "asc" },
    });
    expect(actions.map((entry) => entry.action)).toEqual(["room.created", "room.updated"]);
  });
});

/** A signed-in owner of this place, for calls through the routes (the helper's owner has no session). */
async function ownerOf(businessId: string) {
  const owner = await signUp("Owner");
  const ownerRole = await prisma.role.findFirstOrThrow({ where: { businessId, isOwner: true } });
  await prisma.membership.create({ data: { userId: owner.userId, businessId, roleId: ownerRole.id } });
  return owner;
}
