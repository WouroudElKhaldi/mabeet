import type { z } from "zod";
import { recordAction } from "@/modules/audit/server";
import { assertPlanAllowsAnother } from "@/modules/billing/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { type Db, prisma, runInTransaction } from "@/server/db/client";
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

export async function createRoom(ctx: TenantContext, input: RoomInput) {
  requirePermission(ctx, "rooms.manage");
  await assertPlanAllowsAnother(ctx.businessId, "rooms");
  return runInTransaction(async (tx) => {
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
