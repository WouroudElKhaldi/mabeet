import type { BookingUnit } from "@prisma/client";
import type { z } from "zod";
import { recordAction } from "@/modules/audit/server";
import { assertPlanAllowsAnother } from "@/modules/billing/server";
import { saveBookingUnit } from "@/modules/workspaces/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { type Db, prisma, runInTransaction, type Tx } from "@/server/db/client";
import { notFound } from "@/server/errors";
import { addDays, eachNight, toDateRange, toIsoDate, todayUtc } from "@/utils/dates";
import { secureToken } from "@/utils/tokens";
import type { roomInput, roomUpdate, specialPriceInput } from "../schemas";
import * as rooms from "./room-repository";

// The rooms a host lists, their price per night, and special prices for given nights. Who may book them, and when,
// is the booking engine's: nothing here takes or frees nights.

type RoomInput = z.infer<typeof roomInput>;
type RoomUpdate = z.infer<typeof roomUpdate>;
type SpecialPriceInput = z.infer<typeof specialPriceInput>;

/** Consecutive nights at one price, as a stay: the check-out night is not included. */
interface SpecialPriceRun {
  checkIn: string;
  checkOut: string;
  rateCents: number;
}

async function findRoomOrThrow(db: Db, ctx: TenantContext, roomId: string) {
  const room = await rooms.findRoom(db, ctx.businessId, roomId);
  if (!room) throw notFound("Room");
  return room;
}

export function listRooms(ctx: TenantContext) {
  requirePermission(ctx, "rooms.read");
  return rooms.listRooms(prisma, ctx.businessId);
}

export function getRoom(ctx: TenantContext, roomId: string) {
  requirePermission(ctx, "rooms.read");
  return findRoomOrThrow(prisma, ctx, roomId);
}

/**
 * Makes sure a place booked as a whole has its one whole-place unit, inside `chooseBookingUnit`'s transaction. A new unit starts from the live rooms added up (guests, beds, bathrooms and
 * nightly prices), and the host then adjusts it like any room. One that was taken off is brought back, never doubled.
 * It does not count against the plan's rooms.
 */
async function ensureWholePlaceUnit(ctx: TenantContext, name: string, tx: Tx) {
  requirePermission(ctx, "rooms.manage");
  const existing = await rooms.findWholePlaceUnit(tx, ctx.businessId);
  if (existing) {
    if (existing.active && !existing.isDeleted) return existing.id;
    await rooms.restoreWholePlaceUnit(tx, ctx.businessId, existing.id);
    await recordAction(ctx, "room.updated", "room", existing.id, tx);
    return existing.id;
  }
  const { _sum: sum } = await rooms.sumRooms(tx, ctx.businessId);
  const unit = await rooms.createRoom(tx, {
    businessId: ctx.businessId,
    kind: "WHOLE_PLACE",
    name,
    capacity: Math.max(1, sum.capacity ?? 0),
    bedrooms: sum.bedrooms ?? 1,
    beds: sum.beds ?? 1,
    bathrooms: sum.bathrooms ?? 1,
    baseRateCents: sum.baseRateCents ?? 0,
    minNights: 1,
    amenities: [],
    exportToken: secureToken(),
  });
  await recordAction(ctx, "room.created", "room", unit.id, tx);
  return unit.id;
}

/**
 * The host chooses how guests book the place: room by room, or the whole place as one unit. Booking it whole gives
 * it its whole-place unit, which takes turns with the rooms (no night is sold twice); the rooms stay, and are
 * bookable again when the place goes back to rooms. Bookings already made keep their own unit. One transaction.
 */
export async function chooseBookingUnit(ctx: TenantContext, bookingUnit: BookingUnit) {
  requirePermission(ctx, "settings.manage");
  requirePermission(ctx, "rooms.manage");
  return runInTransaction(async (tx) => {
    const placeName = await saveBookingUnit(ctx.businessId, bookingUnit, tx);
    const wholePlaceUnitId =
      bookingUnit === "WHOLE_PLACE" ? await ensureWholePlaceUnit(ctx, placeName, tx) : null;
    await recordAction(ctx, "settings.booking_unit", "business", ctx.businessId, tx);
    return { bookingUnit, wholePlaceUnitId };
  });
}

export async function createRoom(ctx: TenantContext, input: RoomInput) {
  requirePermission(ctx, "rooms.manage");
  return runInTransaction(async (tx) => {
    // Counted inside the transaction that adds the room, so two rooms added at once cannot pass the limit together.
    await assertPlanAllowsAnother(ctx.businessId, "rooms", tx);
    const room = await rooms.createRoom(tx, {
      ...input,
      businessId: ctx.businessId,
      exportToken: secureToken(),
    });
    await recordAction(ctx, "room.created", "room", room.id, tx);
    return room;
  });
}

export async function updateRoom(ctx: TenantContext, roomId: string, input: RoomUpdate) {
  requirePermission(ctx, "rooms.manage");
  return runInTransaction(async (tx) => {
    if (!(await rooms.updateRoom(tx, ctx.businessId, roomId, input))) throw notFound("Room");
    await recordAction(ctx, "room.updated", "room", roomId, tx);
    return findRoomOrThrow(tx, ctx, roomId);
  });
}

/** Special prices from today on, as runs of nights, so a week at one price reads as one line. */
export async function listSpecialPrices(ctx: TenantContext, roomId: string, now = new Date()) {
  requirePermission(ctx, "rooms.read");
  await findRoomOrThrow(prisma, ctx, roomId);
  return toRuns(await rooms.listSpecialPrices(prisma, ctx.businessId, roomId, todayUtc(now)));
}

/** Sets one price on every night of the range, or clears them (the room's base price applies again). */
export async function setSpecialPrice(
  ctx: TenantContext,
  roomId: string,
  input: SpecialPriceInput,
  now = new Date(),
) {
  requirePermission(ctx, "rooms.manage");
  const range = toDateRange(input);
  await runInTransaction(async (tx) => {
    await findRoomOrThrow(tx, ctx, roomId);
    if (input.rateCents === null) {
      await rooms.clearSpecialPrices(tx, ctx.businessId, roomId, range);
    } else {
      await rooms.setSpecialPrices(tx, ctx.businessId, roomId, eachNight(range), input.rateCents);
    }
    await recordAction(ctx, "room.prices_changed", "room", roomId, tx);
  });
  return listSpecialPrices(ctx, roomId, now);
}

function toRuns(nights: ReadonlyArray<{ date: Date; rateCents: number }>): SpecialPriceRun[] {
  const runs: Array<{ checkIn: Date; checkOut: Date; rateCents: number }> = [];
  for (const { date, rateCents } of nights) {
    const last = runs.at(-1);
    if (last && last.checkOut.getTime() === date.getTime() && last.rateCents === rateCents) {
      last.checkOut = addDays(date, 1);
    } else {
      runs.push({ checkIn: date, checkOut: addDays(date, 1), rateCents });
    }
  }
  return runs.map((run) => ({ ...run, checkIn: toIsoDate(run.checkIn), checkOut: toIsoDate(run.checkOut) }));
}
