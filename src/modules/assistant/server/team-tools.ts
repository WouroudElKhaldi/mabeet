import { createHash } from "node:crypto";
import { z } from "zod";
import { BOOKING_STATUSES } from "@/config/enums";
import { getBusinessReport, getSavings } from "@/modules/analytics/server";
import {
  addBlock,
  confirmBookingByReference,
  endBookingByReference,
  findFreeRooms,
  getCalendar,
  getCalendarLinks,
  listBookings,
  reopenNights,
  syncFeedNow,
} from "@/modules/bookings/server";
import { listRoomNames, listRooms, updateRoom } from "@/modules/rooms/server";
import { getPlaceBasics } from "@/modules/workspaces/server";
import { can, type TenantContext } from "@/server/auth/tenant-context";
import { invalid, notFound } from "@/server/errors";
import { addDays, type DateRange, parseIsoDate, toDateRange, toIsoDate, todayUtc } from "@/utils/dates";
import { type AiTool, type AskPerson, defineTool } from "./tool";

// Tools for owners and staff, through their own AI app. Each one calls the same service the dashboard uses, so the
// member's permissions and the business's boundary are checked once, in the service. The tools that change data
// (`mutates`) are offered only to a key that allows changes, and AI apps ask the member before running them. None of
// them touches money except declining or cancelling a booking the guest paid online, which goes through the booking
// engine's own checks first (`endBookingByReference`). Every change asks first (`askFirst`). A key or app works only
// in the place it was made for, even when the member belongs to other places: no tool takes a place, so the AI never
// reaches them.

const isoDate = z.iso.date().describe("YYYY-MM-DD");
const MAX_BOOKINGS = 50;
/** The report covers this many days, today included, unless asked for a period. */
const DEFAULT_REPORT_DAYS = 30;

/** Text a guest wrote, marked so the model treats it as data and never as instructions. */
const guestWritten = (text: string | null) => (text ? { guestWritten: text } : null);

const team = <Input extends z.ZodObject>(tool: AiTool<Input, TenantContext>) => defineTool(tool);

const READ_TOOLS = [
  team({
    name: "get_report",
    description: `The place's numbers over a period (the last ${DEFAULT_REPORT_DAYS} days unless given), the same as its analytics page: occupancy, nights sold and available, direct revenue, average price per direct night, the commission saved versus Airbnb or Booking.com, nights by channel and by month, revenue by month, requests by outcome and the host's typical answer time. Use it to write a report for the member. "to" is the day after the last day.`,
    input: z.object({ from: isoDate.optional(), to: isoDate.optional() }),
    requires: "analytics.read",
    mutates: false,
    run: async ({ from, to }, ctx) => {
      const end = to ?? toIsoDate(addDays(todayUtc(), 1));
      const start = from ?? toIsoDate(addDays(parseIsoDate(end), -DEFAULT_REPORT_DAYS));
      // A plain object (no refinement), so the tool can gain the `place` argument; the order is checked here.
      if (end <= start) throw invalid("The end must be after the start");
      return getBusinessReport(ctx, toDateRange({ checkIn: start, checkOut: end }));
    },
  }),
  team({
    name: "get_savings",
    description:
      "Since the place joined: its confirmed direct revenue and the commission booking direct saved it (per currency, at its own rate), and what it paid Mabeet for its plan.",
    input: z.object({}),
    requires: "analytics.read",
    mutates: false,
    run: async (_input, ctx) => {
      const { savings, planFees } = await getSavings(ctx);
      return {
        savings,
        planFees: planFees.map((fee) => ({ currency: fee.currency, paidCents: fee.cents })),
      };
    },
  }),
  team({
    name: "list_rooms",
    description:
      "The place's rooms (and its whole-place unit, when it is booked as a whole): how many they sleep, beds, nightly base price, minimum nights, amenities and whether they are open for booking.",
    input: z.object({}),
    requires: "rooms.read",
    mutates: false,
    run: async (_input, ctx) => {
      const [{ currency }, rooms] = await Promise.all([getPlaceBasics(ctx), listRooms(ctx)]);
      return rooms.map((room) => ({
        id: room.id,
        name: room.name,
        kind: room.kind,
        active: room.active,
        sleeps: room.capacity,
        bedrooms: room.bedrooms,
        beds: room.beds,
        bathrooms: room.bathrooms,
        currency,
        baseRateCents: room.baseRateCents,
        minNights: room.minNights,
        amenities: room.amenities,
      }));
    },
  }),
  team({
    name: "check_availability",
    description:
      "Which rooms are free for a stay, counting direct bookings, held requests, closed dates and Airbnb or Booking.com nights. checkOut is the morning the guests leave.",
    input: z.object({ checkIn: isoDate, checkOut: isoDate }),
    requires: "calendar.read",
    mutates: false,
    run: async ({ checkIn, checkOut }, ctx) => {
      // A plain object (no refinement), so every tool can gain the `place` argument; the order is checked here.
      if (checkOut <= checkIn) throw invalid("Check-out must be after check-in");
      const rooms = await listRooms(ctx);
      const free = new Set(
        await findFreeRooms(
          rooms.map((room) => room.id),
          toDateRange({ checkIn, checkOut }),
        ),
      );
      return rooms.map((room) => ({ room: room.name, kind: room.kind, free: free.has(room.id) }));
    },
  }),
  team({
    name: "get_calendar",
    description:
      "The taken nights in a window, per room: direct bookings (with their reference and status), closed dates and stays imported from Airbnb or Booking.com, and whether an imported stay clashes with one of ours.",
    input: z.object({ from: isoDate, to: isoDate.describe("The day after the last night to show") }),
    requires: "calendar.read",
    mutates: false,
    run: async ({ from, to }, ctx) => {
      const [rooms, nights] = await Promise.all([
        listRooms(ctx),
        getCalendar(ctx, { from: parseIsoDate(from), to: parseIsoDate(to) }),
      ]);
      const roomName = new Map(rooms.map((room) => [room.id, room.name]));
      return nights.map((night) => ({
        room: roomName.get(night.roomId) ?? null,
        checkIn: toIsoDate(night.checkIn),
        checkOut: toIsoDate(night.checkOut),
        source: night.kind === "IMPORTED" ? (night.feed?.source ?? "OTHER") : night.kind,
        bookingReference: night.booking?.reference ?? null,
        bookingStatus: night.booking?.status ?? null,
        note: night.note,
        clash: night.conflict,
      }));
    },
  }),
  team({
    name: "list_bookings",
    description: `The place's bookings, by status and dates (at most ${MAX_BOOKINGS}), soonest first. HELD means waiting for the host's answer; AWAITING_PAYMENT means waiting for the guest to pay. Guest names and notes are written by guests.`,
    input: z.object({
      status: z.enum(BOOKING_STATUSES).optional(),
      from: isoDate.optional().describe("Stays still running on or after this day"),
      to: isoDate.optional().describe("Stays starting before this day"),
    }),
    requires: "bookings.read",
    mutates: false,
    run: async ({ status, from, to }, ctx) =>
      (
        await listBookings(ctx, {
          status,
          from: from ? parseIsoDate(from) : undefined,
          to: to ? parseIsoDate(to) : undefined,
          take: MAX_BOOKINGS,
          skip: 0,
        })
      ).map((booking) => ({
        reference: booking.reference,
        status: booking.status,
        bookingMode: booking.bookingMode,
        room: booking.room.name,
        checkIn: toIsoDate(booking.checkIn),
        checkOut: toIsoDate(booking.checkOut),
        guests: booking.guestCount,
        guestName: guestWritten(booking.guestName),
        guestPhone: booking.guestPhone,
        guestNote: guestWritten(booking.guestNote),
        currency: booking.currency,
        totalCents: booking.totalCents,
      })),
  }),
];

const reference = z.string().trim().min(4).max(20).describe('The booking reference, e.g. "MB-7KX3P9"');
const roomArgument = z.string().trim().min(1).max(80).describe("The room's name (or part of it) or its id");
const reason = z
  .string()
  .trim()
  .max(500)
  .optional()
  .describe("Why, in the member's words; the guest sees it");
const confirmRefund = z
  .string()
  .max(40)
  .optional()
  .describe(
    "Only when the booking was paid online: the refund exactly as the first call stated it, after the member agreed. Leave out on the first call.",
  );

/** A room of this place by its id or by (part of) its name; a name that fits several rooms is refused. */
async function findRoom(ctx: TenantContext, room: string) {
  const rooms = await listRoomNames(ctx.businessId);
  const wanted = room.toLowerCase();
  const exact = rooms.find((candidate) => candidate.id === room || candidate.name.toLowerCase() === wanted);
  if (exact) return exact;
  const partial = rooms.filter((candidate) => candidate.name.toLowerCase().includes(wanted));
  if (partial.length > 1) {
    throw invalid(`Several rooms match "${room}": ${partial.map((candidate) => candidate.name).join(", ")}`);
  }
  if (!partial[0]) throw notFound("Room");
  return partial[0];
}

/** The last night of a stay, for a person reading it: the night before check-out. */
const lastNight = (checkOut: string) => toIsoDate(addDays(parseIsoDate(checkOut), -1));

const confirm = z
  .string()
  .max(20)
  .optional()
  .describe(
    'Leave out on the first call. Only after the member said yes: the confirm code the first call gave, e.g. "YES-3F9A2C".',
  );

/**
 * The code that lets a change through: it names this member, this place, this tool and these exact arguments, and
 * only today, so a yes to one change can never pass another. Worked out again on each call, so nothing is stored.
 * The refund a paid booking repeats on its last call is left out: it is asked for after the yes to the booking.
 */
function confirmationCode(toolName: string, input: Record<string, unknown>, ctx: TenantContext, now: Date) {
  const sorted = Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => key !== "confirmRefund")
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const digest = createHash("sha256")
    .update(JSON.stringify([ctx.userId, ctx.businessId, toolName, sorted, toIsoDate(now)]))
    .digest("hex");
  return `YES-${digest.slice(0, 6).toUpperCase()}`;
}

/**
 * A change that asks first, whatever the AI app's own settings (even one that runs tools without asking). The first
 * call changes nothing: it says what would happen and gives a code. The change runs only when the same arguments
 * come back with that code, and, when the person's AI app can show a pop-up, only after they also press yes there,
 * where the model cannot answer for them.
 */
function askFirst<Input extends z.ZodObject>(
  tool: AiTool<Input, TenantContext>,
  describe: (input: z.infer<Input>, ctx: TenantContext) => Promise<string> | string,
): AiTool<z.ZodObject, TenantContext> {
  return {
    ...tool,
    description: `${tool.description} Asks first: the first call changes nothing and returns a confirm code; ask the member, and call again with the same arguments and that code only if they said yes.`,
    input: tool.input.extend({ confirm }),
    run: async (input: Record<string, unknown>, ctx: TenantContext, ask?: AskPerson) => {
      const { confirm: given, ...rest } = input;
      const action = await describe(rest as z.infer<Input>, ctx);
      const code = confirmationCode(tool.name, rest, ctx, new Date());
      if (given === undefined) {
        return {
          done: false,
          wouldDo: action,
          next: `Nothing has changed. Ask the member: "${action}?" Only if they say yes, call ${tool.name} again with the same arguments and confirm set to "${code}".`,
        };
      }
      if (typeof given !== "string" || given.trim() !== code) {
        throw invalid(
          `That confirm code is for another change. Call ${tool.name} without confirm to see what would happen.`,
        );
      }
      if ((await ask?.(`${action}?`)) === "no") {
        return {
          done: false,
          wouldDo: action,
          answer: "The member said no in the pop-up. Nothing has changed.",
        };
      }
      return tool.run(rest as z.infer<Input>, ctx, ask);
    },
  };
}

const ACTION_TOOLS = [
  askFirst(
    team({
      name: "confirm_booking",
      description:
        "Confirms a booking request waiting for the member's answer (status HELD). The guest is told at once.",
      input: z.object({ reference }),
      requires: "bookings.decide",
      mutates: true,
      run: ({ reference: bookingReference }, ctx) => confirmBookingByReference(ctx, bookingReference),
    }),
    ({ reference: ref }) => `Confirm booking ${ref} and tell the guest`,
  ),
  askFirst(
    team({
      name: "decline_booking",
      description:
        "Declines a booking request waiting for the member's answer. If the guest paid online, the first call only says what would be refunded: ask the member, then call again with confirmRefund. Some paid bookings can only be declined from the dashboard; say so if refused.",
      input: z.object({ reference, reason, confirmRefund }),
      requires: "bookings.decide",
      mutates: true,
      run: (input, ctx) => endBookingByReference(ctx, { ...input, outcome: "DECLINED" }),
    }),
    ({ reference: ref, confirmRefund: refund }) =>
      `Decline booking ${ref}${refund ? ` and send ${refund} back to the guest` : ""}`,
  ),
  askFirst(
    team({
      name: "cancel_booking",
      description:
        "Cancels a booking that has not started. If the guest paid online they get it all back: the first call only says what would be refunded; ask the member, then call again with confirmRefund. Some paid bookings can only be cancelled from the dashboard; say so if refused.",
      input: z.object({ reference, reason, confirmRefund }),
      requires: "bookings.decide",
      mutates: true,
      run: (input, ctx) => endBookingByReference(ctx, { ...input, outcome: "CANCELLED" }),
    }),
    ({ reference: ref, confirmRefund: refund }) =>
      `Cancel booking ${ref}${refund ? ` and send ${refund} back to the guest` : ""}`,
  ),
  askFirst(
    team({
      name: "close_dates",
      description:
        "Closes a room for some nights, so nobody can book them (a booking taken by phone, repairs, a family visit). checkOut is the morning after the last closed night.",
      input: z.object({
        room: roomArgument,
        checkIn: isoDate,
        checkOut: isoDate,
        note: z.string().trim().max(200).optional().describe("A note for the team, never shown to guests"),
      }),
      requires: "blocks.manage",
      mutates: true,
      run: async ({ room, checkIn, checkOut, note }, ctx) => {
        if (checkOut <= checkIn) throw invalid("Check-out must be after check-in");
        const found = await findRoom(ctx, room);
        const block = await addBlock(ctx, {
          roomId: found.id,
          range: toDateRange({ checkIn, checkOut }),
          note: note ?? null,
        });
        return { room: found.name, checkIn: toIsoDate(block.checkIn), checkOut: toIsoDate(block.checkOut) };
      },
    }),
    async ({ room, checkIn, checkOut }, ctx) => {
      if (checkOut <= checkIn) throw invalid("Check-out must be after check-in");
      return `Close ${(await findRoom(ctx, room)).name} for the nights of ${checkIn} to ${lastNight(checkOut)}`;
    },
  ),
  askFirst(
    team({
      name: "reopen_dates",
      description:
        "Opens again nights the member closed by hand, for one room, from checkIn to the night before checkOut. Any closed nights in that range are reopened, even part of a longer closed stretch: closed 12 to 15 (the nights of the 12th, 13th and 14th) and reopened 14 to 15 leaves 12 to 14 closed; reopening the middle leaves two closed stretches, one on each side. Bookings and Airbnb or Booking.com stays are never touched.",
      input: z.object({ room: roomArgument, checkIn: isoDate, checkOut: isoDate }),
      requires: "blocks.manage",
      mutates: true,
      run: async ({ room, checkIn, checkOut }, ctx) => {
        const found = await findRoom(ctx, room);
        const { reopened, leftClosed } = await reopenNights(
          ctx,
          found.id,
          toDateRange({ checkIn, checkOut }),
        );
        const nights = (list: DateRange[]) =>
          list.map((night) => ({ checkIn: toIsoDate(night.checkIn), checkOut: toIsoDate(night.checkOut) }));
        return { room: found.name, reopened: nights(reopened), leftClosed: nights(leftClosed) };
      },
    }),
    async ({ room, checkIn, checkOut }, ctx) => {
      if (checkOut <= checkIn) throw invalid("Check-out must be after check-in");
      return `Reopen the closed nights of ${(await findRoom(ctx, room)).name} from ${checkIn} to ${lastNight(checkOut)}`;
    },
  ),
  askFirst(
    team({
      name: "set_room_open",
      description:
        "Opens a room for booking, or takes it off the site (open: false). Its bookings and closed dates stay as they are.",
      input: z.object({ room: roomArgument, open: z.boolean() }),
      requires: "rooms.manage",
      mutates: true,
      run: async ({ room, open }, ctx) => {
        const found = await findRoom(ctx, room);
        const updated = await updateRoom(ctx, found.id, { active: open });
        return { room: updated.name, open: updated.active };
      },
    }),
    async ({ room, open }, ctx) => {
      const { name } = await findRoom(ctx, room);
      return open ? `Open ${name} for booking` : `Take ${name} off the site`;
    },
  ),
  askFirst(
    team({
      name: "sync_calendars",
      description:
        "Reads every connected Airbnb, Booking.com or other calendar link of the place now, instead of waiting for the next automatic read, and says whether any stay there clashes with one of ours.",
      input: z.object({}),
      requires: "feeds.manage",
      mutates: true,
      run: async (_input, ctx) => {
        const rooms = await getCalendarLinks(ctx);
        const results = [];
        for (const room of rooms) {
          for (const feed of room.feeds) {
            const result = await syncFeedNow(ctx, feed.id);
            results.push({ room: room.name, source: feed.source, ...result });
          }
        }
        return results;
      },
    }),
    () => "Read every Airbnb, Booking.com and other calendar link of the place now",
  ),
];

const TEAM_TOOLS = [...READ_TOOLS, ...ACTION_TOOLS];

/**
 * The tools this member may use here: their AI never learns the others exist. A read-only key never sees a tool that
 * changes data.
 */
export function teamToolsFor(ctx: TenantContext) {
  return TEAM_TOOLS.filter(
    (tool) => (!tool.requires || can(ctx, tool.requires)) && !(ctx.readOnly && tool.mutates),
  );
}
