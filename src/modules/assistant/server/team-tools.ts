import { z } from "zod";
import { BOOKING_STATUSES } from "@/config/enums";
import { getBusinessReport, getSavings } from "@/modules/analytics/server";
import { findFreeRooms, getCalendar, listBookings } from "@/modules/bookings/server";
import { listRooms } from "@/modules/rooms/server";
import { listWorkspaces } from "@/modules/team/server";
import { getPlaceBasics } from "@/modules/workspaces/server";
import { can, type TenantContext } from "@/server/auth/tenant-context";
import { resolveContext } from "@/server/auth/resolve-context";
import { invalid, notFound } from "@/server/errors";
import { addDays, parseIsoDate, toDateRange, toIsoDate, todayUtc } from "@/utils/dates";
import { type AiTool, defineTool } from "./tool";

// Tools for owners and staff, through their own AI app. Each one calls the same service the dashboard uses, so the
// member's permissions and the business's boundary are checked once, in the service. This first version only reads:
// no tool changes data.

const isoDate = z.iso.date().describe("YYYY-MM-DD");
const MAX_BOOKINGS = 50;
/** The report covers this many days, today included, unless asked for a period. */
const DEFAULT_REPORT_DAYS = 30;

/** Text a guest wrote, marked so the model treats it as data and never as instructions. */
const guestWritten = (text: string | null) => (text ? { guestWritten: text } : null);

const team = <Input extends z.ZodObject>(tool: AiTool<Input, TenantContext>) => defineTool(tool);

/** The member's places, with their role in each, so they can name one in any tool's `place`. */
async function listMyPlaces(ctx: TenantContext) {
  const memberships = await listWorkspaces(ctx.userId);
  return memberships.map((membership) => ({
    id: membership.business.id,
    name: membership.business.name,
    role: membership.role.name,
    current: membership.business.id === ctx.businessId,
  }));
}

/**
 * The member in another of their places, by its id or (part of) its name; the current place when none is named. A
 * name that fits several places is refused rather than guessed. A read-only key stays read only everywhere.
 */
async function resolvePlaceContext(ctx: TenantContext, place: string | undefined): Promise<TenantContext> {
  if (!place) return ctx;
  const wanted = place.trim().toLowerCase();
  const places = await listMyPlaces(ctx);
  const byId = places.find((candidate) => candidate.id === place);
  const byName = places.filter((candidate) => candidate.name.toLowerCase().includes(wanted));
  const match = byId ?? (byName.length === 1 ? byName[0] : undefined);
  if (!match && byName.length > 1) {
    throw invalid(
      `Several of your places match "${place}": ${byName.map((candidate) => candidate.name).join(", ")}`,
    );
  }
  if (!match) throw notFound("Place");
  if (match.id === ctx.businessId) return ctx;
  const next = await resolveContext(ctx.userId, match.id, ctx.channel);
  if (!next) throw notFound("Place");
  return { ...next, readOnly: ctx.readOnly };
}

const SINGLE_PLACE_TOOLS = [
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

/** The optional argument every place tool gains, so the AI can work in any of the member's places. */
const placeArgument = z
  .string()
  .max(80)
  .optional()
  .describe(
    "Which of the member's places this is about: its name, part of its name, or its id (list_places shows them). Leave out for the current place.",
  );

/** A place tool that takes an optional `place` and runs as the member there, with their role in that place. */
function inAnyPlace(tool: AiTool<z.ZodObject, TenantContext>): AiTool<z.ZodObject, TenantContext> {
  return {
    ...tool,
    input: tool.input.extend({ place: placeArgument }),
    run: async (input, ctx) => {
      const { place, ...rest } = input as { place?: string };
      return tool.run(rest, await resolvePlaceContext(ctx, place));
    },
  };
}

const TEAM_TOOLS = [
  team({
    name: "list_places",
    description:
      "The member's places, with their role in each and which one is current. Use a place's name in any other tool's `place` to ask about it.",
    input: z.object({}),
    mutates: false,
    run: (_input, ctx) => listMyPlaces(ctx),
  }),
  ...SINGLE_PLACE_TOOLS.map(inAnyPlace),
];

/**
 * The tools this member may use here: their AI never learns the others exist. A read-only key never sees a tool that
 * changes data.
 */
export function teamToolsFor(ctx: TenantContext) {
  return TEAM_TOOLS.filter(
    (tool) => (!tool.requires || can(ctx, tool.requires)) && !(ctx.readOnly && tool.mutates),
  );
}
