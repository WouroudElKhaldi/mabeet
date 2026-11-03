import { recordAction } from "@/modules/audit/server";
import { listRoomNames } from "@/modules/rooms/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { overlapAsConflict } from "@/server/db/constraint-errors";
import { invalid, notFound } from "@/server/errors";
import { addDays, countNights, type DateRange, todayUtc } from "@/utils/dates";
import * as bookings from "./booking-repository";
import { recheckImportClashes } from "./import-clashes";

// The calendar and closed dates. A closed night is a MANUAL night row, under the same overlap rule and room lock as
// bookings, so it can never be closed over a booking, nor booked once closed. Hosts also close nights for a booking
// taken by phone.

const NIGHTS_TAKEN = "Those nights are already booked or closed.";
const MAX_DAYS_AHEAD = 540;
/** The calendar shows six weeks unless asked for other dates, and at most about a year at once. */
const DEFAULT_WINDOW_DAYS = 42;
const MAX_WINDOW_DAYS = 400;

interface CalendarQuery {
  from?: Date;
  to?: Date;
  roomId?: string;
}

/** Every taken night of the place in a window, from every source: our bookings, closed dates and platform stays. */
export async function getCalendar(ctx: TenantContext, query: CalendarQuery, now = new Date()) {
  requirePermission(ctx, "calendar.read");
  const checkIn = query.from ?? todayUtc(now);
  const checkOut = query.to ?? addDays(checkIn, DEFAULT_WINDOW_DAYS);
  if (checkOut <= checkIn) throw invalid("The end date must be after the start date");
  if (countNights({ checkIn, checkOut }) > MAX_WINDOW_DAYS) {
    throw invalid(`Show at most ${MAX_WINDOW_DAYS} days at once`);
  }
  return bookings.listOccupancy(prisma, ctx.businessId, { checkIn, checkOut }, query.roomId);
}

/**
 * The calendar screen: the place's rooms and every taken night in the window, read under the calendar's own
 * permission, so a member who may see the calendar sees the rooms' names on it.
 */
export async function getCalendarBoard(ctx: TenantContext, query: CalendarQuery, now = new Date()) {
  requirePermission(ctx, "calendar.read");
  const [rooms, occupancy] = await Promise.all([listRoomNames(ctx.businessId), getCalendar(ctx, query, now)]);
  return { rooms, occupancy };
}

interface BlockInput {
  roomId: string;
  range: DateRange;
  note: string | null;
}

export async function addBlock(ctx: TenantContext, input: BlockInput, now = new Date()) {
  requirePermission(ctx, "blocks.manage");
  const today = todayUtc(now);
  if (input.range.checkOut <= today) throw invalid("Those nights are already past");
  if (input.range.checkIn > addDays(today, MAX_DAYS_AHEAD)) throw invalid("Those dates are too far ahead");
  const block = await overlapAsConflict(NIGHTS_TAKEN, () =>
    runInTransaction(async (tx) => {
      if (!(await bookings.lockActiveRoom(tx, ctx.businessId, input.roomId))) throw notFound("Room");
      const created = await bookings.createManualBlock(tx, { ...input, businessId: ctx.businessId });
      await recordAction(ctx, "block.added", "occupancy", created.id, tx);
      return created;
    }),
  );
  await recheckImportClashes(ctx.businessId, block.roomId, now);
  return block;
}

export async function removeBlock(ctx: TenantContext, blockId: string, now = new Date()) {
  requirePermission(ctx, "blocks.manage");
  const block = await bookings.findActiveBlock(prisma, ctx.businessId, blockId);
  if (!block) throw notFound("Closed dates");
  await runInTransaction(async (tx) => {
    await bookings.lockActiveRoom(tx, ctx.businessId, block.roomId);
    if (!(await bookings.deactivateManualBlock(tx, ctx.businessId, blockId))) throw notFound("Closed dates");
    await recordAction(ctx, "block.removed", "occupancy", blockId, tx);
  });
  await recheckImportClashes(ctx.businessId, block.roomId, now);
}
