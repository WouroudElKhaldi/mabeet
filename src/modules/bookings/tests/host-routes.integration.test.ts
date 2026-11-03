import { describe, expect, it } from "vitest";
import * as blockItem from "@/app/api/workspaces/[businessId]/blocks/[blockId]/route";
import * as blockList from "@/app/api/workspaces/[businessId]/blocks/route";
import * as decision from "@/app/api/workspaces/[businessId]/bookings/[bookingId]/[action]/route";
import * as payments from "@/app/api/workspaces/[businessId]/bookings/[bookingId]/payments/route";
import * as bookingItem from "@/app/api/workspaces/[businessId]/bookings/[bookingId]/route";
import * as bookingList from "@/app/api/workspaces/[businessId]/bookings/route";
import * as calendar from "@/app/api/workspaces/[businessId]/calendar/route";
import { prisma, stay } from "@tests/integration/helpers";
import { type Caller, call, signUp } from "@tests/integration/http";
import { toIsoDate } from "@/utils/dates";
import { requestBooking } from "../server";
import { placeWithRoom, requestFor } from "./fixtures";

// The host's booking routes, called as the dashboard calls them: who may read, decide and close dates is the
// member's role, a guest's contact is masked without guests.contact, and another place's booking is not found.

type Place = Awaited<ReturnType<typeof placeWithRoom>>;

/** A signed-in member of the place with one of its starter roles. */
async function memberAs(place: Place, roleName: string): Promise<Caller> {
  const member = await signUp(roleName);
  const role = await prisma.role.findFirstOrThrow({
    where: {
      businessId: place.business.id,
      ...(roleName === "Owner" ? { isOwner: true } : { name: roleName }),
    },
  });
  await prisma.membership.create({
    data: { userId: member.userId, businessId: place.business.id, roleId: role.id },
  });
  return member;
}

const nights = (range: ReturnType<typeof stay>) => ({
  checkIn: toIsoDate(range.checkIn),
  checkOut: toIsoDate(range.checkOut),
});

describe("the host's bookings", () => {
  it("lists, opens and confirms a request, and declines and cancels others", async () => {
    const place = await placeWithRoom();
    const owner = await memberAs(place, "Owner");
    const businessId = place.business.id;
    const first = await requestBooking(requestFor(place, stay(10, 2)));
    const second = await requestBooking(requestFor(place, stay(14, 2)));
    const third = await requestBooking(requestFor(place, stay(20, 2)));

    const listed = await call(bookingList.GET, {
      as: owner,
      params: { businessId },
      query: { status: "HELD" },
    });
    expect(listed.status).toBe(200);
    expect((listed.body as Array<{ id: string }>).map((booking) => booking.id).sort()).toEqual(
      [first.id, second.id, third.id].sort(),
    );
    const opened = await call(bookingItem.GET, { as: owner, params: { businessId, bookingId: first.id } });
    expect(opened).toMatchObject({ status: 200, body: { id: first.id, guestPhone: "+96171123456" } });

    const answer = (bookingId: string, action: string, body: unknown = {}) =>
      call(decision.POST, { as: owner, params: { businessId, bookingId, action }, body });
    expect(await answer(first.id, "confirm")).toMatchObject({ status: 200, body: { status: "CONFIRMED" } });
    expect(await answer(second.id, "decline", { reason: "Closed for a wedding" })).toMatchObject({
      status: 200,
      body: { status: "DECLINED" },
    });
    expect(await answer(third.id, "cancel")).toMatchObject({ status: 200, body: { status: "CANCELLED" } });
    // A decision on a booking that already moved on is refused, and an unknown action is a bad request.
    expect((await answer(first.id, "decline")).status).toBe(409);
    expect((await answer(first.id, "approve")).status).toBe(400);
  });

  it("lets housekeeping read but not decide, and masks the guest's contact for them", async () => {
    const place = await placeWithRoom();
    const housekeeping = await memberAs(place, "Housekeeping");
    const businessId = place.business.id;
    const booking = await requestBooking(requestFor(place, stay(10, 2)));

    const seen = await call(bookingItem.GET, {
      as: housekeeping,
      params: { businessId, bookingId: booking.id },
    });
    expect(seen.status).toBe(200);
    expect((seen.body as { guestPhone: string }).guestPhone).not.toBe("+96171123456");
    const decided = await call(decision.POST, {
      as: housekeeping,
      params: { businessId, bookingId: booking.id, action: "confirm" },
      body: {},
    });
    expect(decided.status).toBe(403);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("HELD");
  });

  it("answers 404 for another place's booking and 401 to someone signed out", async () => {
    const place = await placeWithRoom();
    const other = await placeWithRoom();
    const owner = await memberAs(place, "Owner");
    const theirs = await requestBooking(requestFor(other, stay(10, 2)));
    const params = { businessId: place.business.id, bookingId: theirs.id };
    expect((await call(bookingItem.GET, { as: owner, params })).status).toBe(404);
    expect((await call(bookingList.GET, { params: { businessId: place.business.id } })).status).toBe(401);
  });

  it("shows a booking's payments to the owner only", async () => {
    const place = await placeWithRoom();
    const owner = await memberAs(place, "Owner");
    const frontDesk = await memberAs(place, "Front desk");
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    const params = { businessId: place.business.id, bookingId: booking.id };
    expect(await call(payments.GET, { as: owner, params })).toEqual({ status: 200, body: [] });
    expect((await call(payments.GET, { as: frontDesk, params })).status).toBe(403);
  });
});

describe("closing dates and the calendar", () => {
  it("closes nights, shows them in the calendar, and reopens them", async () => {
    const place = await placeWithRoom();
    const frontDesk = await memberAs(place, "Front desk");
    const businessId = place.business.id;
    const range = stay(10, 3);

    const closed = await call(blockList.POST, {
      as: frontDesk,
      params: { businessId },
      body: { roomId: place.room.id, note: "Painting", ...nights(range) },
    });
    expect(closed).toMatchObject({ status: 201, body: { roomId: place.room.id, note: "Painting" } });
    const blockId = (closed.body as { id: string }).id;

    const shown = await call(calendar.GET, {
      as: frontDesk,
      params: { businessId },
      query: { from: toIsoDate(stay(0, 1).checkIn), to: toIsoDate(stay(30, 1).checkIn) },
    });
    expect(shown.status).toBe(200);
    expect((shown.body as Array<{ id: string }>).map((night) => night.id)).toContain(blockId);

    expect(await call(blockItem.DELETE, { as: frontDesk, params: { businessId, blockId } })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect((await call(blockItem.DELETE, { as: frontDesk, params: { businessId, blockId } })).status).toBe(
      404,
    );
  });

  it("refuses closing dates to housekeeping, who can only read the calendar", async () => {
    const place = await placeWithRoom();
    const housekeeping = await memberAs(place, "Housekeeping");
    const params = { businessId: place.business.id };
    const body = { roomId: place.room.id, ...nights(stay(10, 2)) };
    expect((await call(blockList.POST, { as: housekeeping, params, body })).status).toBe(403);
    expect((await call(calendar.GET, { as: housekeeping, params })).status).toBe(200);
  });
});
