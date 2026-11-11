import type { PaymentMethod } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as hostMcpRoute from "@/app/api/mcp/route";
import { addRoom, createPlace, createUser, memberWith, prisma, stay } from "@tests/integration/helpers";
import { addBlock, requestBooking } from "@/modules/bookings/server";
import type { TenantContext } from "@/server/auth/tenant-context";
import { env } from "@/server/env";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { addDays, toIsoDate, todayUtc } from "@/utils/dates";
import { createKey } from "../server";

// What a member's AI app may change through the host MCP. Only a key that allows changes is offered the actions,
// and only those the member's role allows. Ending a booking the guest paid online passes every check of
// `endBookingByReference` first, and a refusal never tells the host anything about Mabeet's own money.

const USE_THE_DASHBOARD = /can't be ended from an AI app/;
let nextId = 1;

// Refunds go to stand-ins for Whish and Stripe, never the real ones, even when keys are set for development. Each
// refund is accepted, so none is left owed in the shared test database for another test's retry to find. Card
// refunds are also checked against Mabeet's Stripe balance, which a test can set.
const saved = { STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY, WHISH_MODE: env.WHISH_MODE };
beforeAll(() => {
  Object.assign(env, { STRIPE_SECRET_KEY: "sk_test_ai_actions", WHISH_MODE: "simulator" });
});
afterAll(() => {
  Object.assign(env, saved);
});
beforeEach(() => {
  providersWithStripeBalance(1_000_000);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** Whish and Stripe as seen from here: every refund accepted, and Stripe's balance in US dollars. */
function providersWithStripeBalance(availableCents: number) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/v1/balance")) {
      return Response.json({ available: [{ amount: availableCents, currency: "usd" }] });
    }
    if (url.endsWith("/v1/refunds")) return Response.json({ id: "re_test", status: "succeeded" });
    if (url.endsWith("/payment/whish/refund")) return Response.json({ status: true, code: null, data: {} });
    throw new Error(`No outside call is expected here: ${url}`);
  });
}

async function mcp(secret: string, method: string, params: object = {}) {
  const request = new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const response = await hostMcpRoute.POST(request, { params: Promise.resolve({}) });
  const { result } = (await response.json()) as { result: Record<string, unknown> };
  return result;
}

async function tool(secret: string, name: string, args: object = {}) {
  const result = await mcp(secret, "tools/call", { name, arguments: args });
  const text = (result.content as Array<{ text: string }>)[0]?.text ?? "null";
  // Our tools answer JSON; the MCP library answers plain text for a tool this key was not offered.
  const payload = (
    text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : { error: text }
  ) as Record<string, unknown>;
  return { isError: result.isError as boolean, payload };
}

const toolNames = async (secret: string) =>
  ((await mcp(secret, "tools/list")).tools as Array<{ name: string }>).map((entry) => entry.name);

const ACTIONS = [
  "confirm_booking",
  "decline_booking",
  "cancel_booking",
  "close_dates",
  "reopen_dates",
  "set_room_open",
  "sync_calendars",
];

/** A place in a booking mode, with a room, a guest, and the owner's key that allows changes. */
async function placeWithWritingKey(mode: "OFFLINE" | "AUTOMATIC" | "ONLINE_APPROVAL" = "AUTOMATIC") {
  const place = await createPlace();
  await prisma.business.update({
    where: { id: place.business.id },
    data: { bookingMode: mode, onlineTermsAcceptedAt: mode === "OFFLINE" ? null : new Date() },
  });
  const room = await addRoom(place.business.id, { capacity: 2 });
  const guest = await createUser("Maya Haddad");
  const key = await createKey(place.ctx, { name: "Claude", expiresInDays: 30, canWrite: true });
  return { ...place, room, guest, key };
}

type Place = Awaited<ReturnType<typeof placeWithWritingKey>>;

async function booking(place: Place, fromToday: number) {
  return requestBooking({
    businessSlug: place.business.slug,
    roomId: place.room.id,
    range: stay(fromToday, 1),
    guestCount: 2,
    guestName: "Maya Haddad",
    guestPhone: "+96171123456",
    guestEmail: null,
    guestNote: null,
    guestUserId: place.guest.id,
  });
}

/** A confirmed stay `fromToday` days ahead, paid online in full. */
async function paidStay(
  place: Place,
  fromToday: number,
  { amountCents = 20_000, currency = "USD", method = "WHISH" as PaymentMethod } = {},
) {
  const made = await booking(place, fromToday);
  await prisma.booking.update({ where: { id: made.id }, data: { status: "CONFIRMED", currency } });
  await prisma.payment.create({
    data: {
      businessId: place.business.id,
      bookingId: made.id,
      amountCents,
      currency,
      method,
      status: "PAID",
      paidAt: new Date(),
    },
  });
  return made;
}

const statusOf = async (bookingId: string) =>
  (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status;

const refusalsLogged = (bookingId: string) =>
  prisma.auditLog.findMany({
    where: { entity: "booking", entityId: bookingId, action: { startsWith: "booking.ai_refund_refused" } },
    select: { action: true },
  });

describe("who is offered the actions", () => {
  beforeEach(resetMemoryRateLimits);

  it("offers them only to a key that allows changes, and only as far as the member's role goes", async () => {
    const place = await placeWithWritingKey();
    expect(await toolNames(place.key.secret)).toEqual(expect.arrayContaining(ACTIONS));
    for (const action of ACTIONS) {
      const listed = (
        (await mcp(place.key.secret, "tools/list")).tools as Array<{
          name: string;
          annotations: { readOnlyHint: boolean };
        }>
      ).find((entry) => entry.name === action);
      expect(listed?.annotations.readOnlyHint).toBe(false);
    }

    const readOnly = await createKey(place.ctx, { name: "Read only", expiresInDays: 30 });
    expect(await toolNames(readOnly.secret)).not.toEqual(expect.arrayContaining(["confirm_booking"]));
    for (const action of ACTIONS) expect(await toolNames(readOnly.secret)).not.toContain(action);
    // Even if the AI app names one anyway, it does not exist for this key.
    expect(await tool(readOnly.secret, "close_dates", {})).toMatchObject({ isError: true });

    const frontDesk: TenantContext = await memberWith(place.business.id, ["bookings.read", "ai.use"]);
    const staffKey = await createKey(frontDesk, { name: "Desk", expiresInDays: 30, canWrite: true });
    const offered = await toolNames(staffKey.secret);
    for (const action of ACTIONS) expect(offered).not.toContain(action);
  });
});

describe("actions that move no money", () => {
  beforeEach(resetMemoryRateLimits);

  it("confirms a request, and cancels one nobody paid online for at once", async () => {
    const place = await placeWithWritingKey("OFFLINE");
    const waiting = await booking(place, 20);
    expect(await tool(place.key.secret, "confirm_booking", { reference: waiting.reference })).toMatchObject({
      isError: false,
      payload: { reference: waiting.reference, status: "CONFIRMED" },
    });
    expect(
      await tool(place.key.secret, "cancel_booking", { reference: waiting.reference, reason: "Pipes burst" }),
    ).toMatchObject({ isError: false, payload: { done: true, status: "CANCELLED", refund: null } });
    expect(await tool(place.key.secret, "confirm_booking", { reference: "MB-NOPE00" })).toMatchObject({
      isError: true,
    });
  });

  it("closes and reopens nights, keeping the closed nights outside the days asked", async () => {
    const place = await placeWithWritingKey();
    const day = (offset: number) => toIsoDate(addDays(todayUtc(), offset));
    const closed = await tool(place.key.secret, "close_dates", {
      room: place.room.name.toUpperCase(),
      checkIn: day(30),
      checkOut: day(33),
      note: "Family visit",
    });
    expect(closed).toMatchObject({ isError: false, payload: { checkIn: day(30), checkOut: day(33) } });
    await addBlock(place.ctx, { roomId: place.room.id, range: stay(34, 4), note: null });

    const reopened = await tool(place.key.secret, "reopen_dates", {
      room: place.room.id,
      checkIn: day(29),
      checkOut: day(36),
    });
    expect(reopened.payload).toMatchObject({
      reopened: [
        { checkIn: day(30), checkOut: day(33) },
        { checkIn: day(34), checkOut: day(36) },
      ],
      leftClosed: [{ checkIn: day(36), checkOut: day(38) }],
    });
    expect(
      await prisma.occupancy.count({ where: { roomId: place.room.id, kind: "MANUAL", active: true } }),
    ).toBe(1);
  });

  it("reopens only the last night of a closed stretch, as a host asks it", async () => {
    const place = await placeWithWritingKey();
    const day = (offset: number) => toIsoDate(addDays(todayUtc(), offset));
    // Closed for the nights of the 12th, 13th and 14th; then the 14th is wanted back.
    await tool(place.key.secret, "close_dates", {
      room: place.room.name,
      checkIn: day(12),
      checkOut: day(15),
    });
    const reopened = await tool(place.key.secret, "reopen_dates", {
      room: place.room.name,
      checkIn: day(14),
      checkOut: day(15),
    });
    expect(reopened).toMatchObject({
      isError: false,
      payload: {
        reopened: [{ checkIn: day(14), checkOut: day(15) }],
        leftClosed: [{ checkIn: day(12), checkOut: day(14) }],
      },
    });
  });

  it("takes a room off the site and opens it again", async () => {
    const place = await placeWithWritingKey();
    expect(
      (await tool(place.key.secret, "set_room_open", { room: place.room.name, open: false })).payload,
    ).toMatchObject({ open: false });
    expect((await prisma.room.findUniqueOrThrow({ where: { id: place.room.id } })).active).toBe(false);
    await tool(place.key.secret, "set_room_open", { room: place.room.name, open: true });
    expect((await prisma.room.findUniqueOrThrow({ where: { id: place.room.id } })).active).toBe(true);
  });
});

describe("ending a booking the guest paid online", () => {
  beforeEach(resetMemoryRateLimits);

  it("first says what would happen, and only ends it when the exact refund is repeated", async () => {
    const place = await placeWithWritingKey();
    const paid = await paidStay(place, 20);
    const first = await tool(place.key.secret, "cancel_booking", { reference: paid.reference });
    expect(first).toMatchObject({
      isError: false,
      payload: { done: false, refund: "$200.00", refundMethod: ["WHISH"], status: "CONFIRMED" },
    });
    expect(await statusOf(paid.id)).toBe("CONFIRMED");

    const wrong = await tool(place.key.secret, "cancel_booking", {
      reference: paid.reference,
      confirmRefund: "$20.00",
    });
    expect(wrong).toMatchObject({ isError: true });
    expect(JSON.stringify(wrong.payload)).toContain("$200.00");
    expect(await statusOf(paid.id)).toBe("CONFIRMED");

    const done = await tool(place.key.secret, "cancel_booking", {
      reference: paid.reference,
      reason: "Water cut",
      confirmRefund: "$200.00",
    });
    expect(done).toMatchObject({
      isError: false,
      payload: { done: true, status: "CANCELLED", refund: "$200.00" },
    });
    expect(await statusOf(paid.id)).toBe("CANCELLED");
    expect(await prisma.refund.findMany({ where: { payment: { bookingId: paid.id } } })).toEqual([
      expect.objectContaining({ amountCents: 20_000, status: "DONE" }),
    ]);
  });

  it("declines a paid request the same way", async () => {
    const place = await placeWithWritingKey("ONLINE_APPROVAL");
    const paid = await paidStay(place, 25);
    await prisma.booking.update({ where: { id: paid.id }, data: { status: "HELD" } });
    expect(
      (await tool(place.key.secret, "decline_booking", { reference: paid.reference })).payload,
    ).toMatchObject({ done: false, refund: "$200.00" });
    expect(
      (
        await tool(place.key.secret, "decline_booking", {
          reference: paid.reference,
          confirmRefund: "$200.00",
        })
      ).payload,
    ).toMatchObject({ done: true, status: "DECLINED" });
  });

  it("is for owners only: staff who may decide on bookings end paid ones from the dashboard", async () => {
    const place = await placeWithWritingKey();
    const paid = await paidStay(place, 20);
    const manager = await memberWith(place.business.id, ["bookings.read", "bookings.decide", "ai.use"]);
    const managerKey = await createKey(manager, { name: "Manager", expiresInDays: 30, canWrite: true });
    const refused = await tool(managerKey.secret, "cancel_booking", { reference: paid.reference });
    expect(refused).toMatchObject({ isError: true });
    expect(JSON.stringify(refused.payload)).toContain("Only an owner");
    expect(await statusOf(paid.id)).toBe("CONFIRMED");
  });

  it("refuses a stay starting within two days, and logs why", async () => {
    const place = await placeWithWritingKey();
    const paid = await paidStay(place, 1);
    const refused = await tool(place.key.secret, "cancel_booking", { reference: paid.reference });
    expect(refused).toMatchObject({
      isError: true,
      payload: { error: expect.stringMatching(USE_THE_DASHBOARD) },
    });
    expect(await refusalsLogged(paid.id)).toEqual([{ action: "booking.ai_refund_refused.starts_soon" }]);
    expect(await statusOf(paid.id)).toBe("CONFIRMED");
  });

  it("refuses when what Mabeet holds for the place no longer covers the refund, without saying how much it holds", async () => {
    const place = await placeWithWritingKey();
    const paid = await paidStay(place, 20);
    // An earlier payout took more than this place had with Mabeet.
    await prisma.payout.create({
      data: {
        businessId: place.business.id,
        amountCents: 15_000,
        currency: "USD",
        method: "WHISH",
        accountName: "Rima Khoury",
        whishPhone: "+96170123456",
        status: "PAID",
        requestedById: place.ctx.userId,
      },
    });
    const refused = await tool(place.key.secret, "cancel_booking", {
      reference: paid.reference,
      confirmRefund: "$200.00",
    });
    expect(refused).toMatchObject({
      isError: true,
      payload: { error: expect.stringMatching(USE_THE_DASHBOARD) },
    });
    expect(JSON.stringify(refused.payload)).not.toMatch(/\$|\d{2,}/);
    expect(await refusalsLogged(paid.id)).toEqual([{ action: "booking.ai_refund_refused.host_balance" }]);
    expect(await statusOf(paid.id)).toBe("CONFIRMED");
  });

  it("refuses when the company's money in that currency is short, telling the host nothing about it", async () => {
    // Jordanian dinars are used by no other test, so only these rows make up Mabeet's money in them.
    const place = await placeWithWritingKey();
    const paid = await paidStay(place, 20, { currency: "JOD" });
    const other = await createPlace();
    await prisma.payout.create({
      data: {
        businessId: other.business.id,
        amountCents: 1_000_000_000,
        currency: "JOD",
        method: "BANK_TRANSFER",
        accountName: "Another host",
        bankName: "Bank Audi",
        iban: "LB62099900000001001901229114",
        status: "PAID",
        requestedById: other.ctx.userId,
      },
    });
    const amount = (await tool(place.key.secret, "cancel_booking", { reference: paid.reference })).payload
      .refund as string;
    const refused = await tool(place.key.secret, "cancel_booking", {
      reference: paid.reference,
      confirmRefund: amount,
    });
    expect(refused).toMatchObject({
      isError: true,
      payload: { error: expect.stringMatching(USE_THE_DASHBOARD) },
    });
    expect(JSON.stringify(refused.payload)).not.toMatch(/JOD|\d{2,}/);
    expect(await refusalsLogged(paid.id)).toEqual([{ action: "booking.ai_refund_refused.platform_balance" }]);
    expect(await statusOf(paid.id)).toBe("CONFIRMED");
  });

  it("checks Mabeet's card balance before a card refund, and never ends one it cannot check", async () => {
    const place = await placeWithWritingKey();
    const ask = (reference: string) =>
      tool(place.key.secret, "cancel_booking", { reference, confirmRefund: "$200.00" });

    const off = await paidStay(place, 20, { method: "STRIPE" });
    env.STRIPE_SECRET_KEY = undefined;
    try {
      expect(await ask(off.reference)).toMatchObject({ isError: true });
    } finally {
      env.STRIPE_SECRET_KEY = "sk_test_ai_actions";
    }
    expect(await refusalsLogged(off.id)).toEqual([{ action: "booking.ai_refund_refused.card_provider" }]);

    const short = await paidStay(place, 22, { method: "STRIPE" });
    providersWithStripeBalance(19_999);
    const refused = await ask(short.reference);
    expect(refused).toMatchObject({
      isError: true,
      payload: { error: expect.stringMatching(USE_THE_DASHBOARD) },
    });
    expect(JSON.stringify(refused.payload)).not.toMatch(/199|\$/);
    expect(await refusalsLogged(short.id)).toEqual([{ action: "booking.ai_refund_refused.card_balance" }]);
    expect(await statusOf(short.id)).toBe("CONFIRMED");

    providersWithStripeBalance(1_000_000);
    expect((await ask(short.reference)).payload).toMatchObject({ done: true, status: "CANCELLED" });
  });

  it("ends at most three paid bookings a day for one place", async () => {
    const place = await placeWithWritingKey();
    const stays = [];
    for (const offset of [20, 22, 24, 26]) stays.push(await paidStay(place, offset));
    for (const paid of stays.slice(0, 3)) {
      expect(
        (
          await tool(place.key.secret, "cancel_booking", {
            reference: paid.reference,
            confirmRefund: "$200.00",
          })
        ).payload,
      ).toMatchObject({ done: true });
    }
    const fourth = stays[3];
    if (!fourth) throw new Error("four stays were made");
    const refused = await tool(place.key.secret, "cancel_booking", {
      reference: fourth.reference,
      confirmRefund: "$200.00",
    });
    expect(refused).toMatchObject({
      isError: true,
      payload: { error: expect.stringMatching(USE_THE_DASHBOARD) },
    });
    expect(await refusalsLogged(fourth.id)).toEqual([{ action: "booking.ai_refund_refused.daily_limit" }]);
    expect(await statusOf(fourth.id)).toBe("CONFIRMED");
  });
});
