import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import * as guestMcpRoute from "@/app/api/mcp/guest/route";
import { addRoom, createPlace, prisma, stay } from "@tests/integration/helpers";
import { addBlock } from "@/modules/bookings/server";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { toIsoDate } from "@/utils/dates";

// The public guest MCP on the real database, called the way Claude or ChatGPT calls it: it finds listed places that
// are free, checks a place's dates, reads a place, and never gives away what a host has not published.

let nextId = 1;

async function callTool(name: string, args: object, address = "203.0.113.7") {
  const request = new Request("http://localhost/api/mcp/guest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-forwarded-for": address,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId++,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const response = await guestMcpRoute.POST(request, { params: Promise.resolve({}) });
  if (response.status !== 200) return { status: response.status, isError: true, payload: null };
  const { result } = (await response.json()) as {
    result: { isError: boolean; content: Array<{ text: string }> };
  };
  return {
    status: response.status,
    isError: result.isError,
    payload: JSON.parse(result.content[0]?.text ?? "null") as unknown,
  };
}

async function listedPlace(word = randomUUID().slice(0, 8)) {
  const place = await createPlace(`Beit ${word} ${randomUUID().slice(0, 4)}`);
  await prisma.business.update({
    where: { id: place.business.id },
    data: {
      listedPublicly: true,
      area: "Ehden",
      region: "north",
      paymentInstructions: "Whish 03 123 456",
      commissionRateBps: 1500,
    },
  });
  const room = await addRoom(place.business.id, { capacity: 2, baseRateCents: 12_000, minNights: 2 });
  return { ...place, word, room };
}

describe("the guest MCP", () => {
  beforeEach(resetMemoryRateLimits);

  it("finds a listed place that is free, with its rooms, prices and booking link", async () => {
    const { business, word } = await listedPlace();
    const range = stay(20, 2);
    const checkIn = toIsoDate(range.checkIn);
    const checkOut = toIsoDate(range.checkOut);

    const found = await callTool("search_places", {
      text: word,
      area: "North Lebanon",
      checkIn,
      checkOut,
      guests: 2,
    });
    expect(found.isError).toBe(false);
    expect(found.payload).toEqual({
      moreMatch: false,
      places: [
        expect.objectContaining({
          slug: business.slug,
          area: "Ehden",
          stayTotalFrom: "$240.00",
          bookingLink: expect.stringContaining(
            `/p/${business.slug}?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`,
          ),
          rooms: [expect.objectContaining({ sleeps: 2 })],
        }),
      ],
    });

    expect((await callTool("search_places", { text: word, guests: 3 })).payload).toEqual({
      moreMatch: false,
      places: [],
    });
  });

  it("gives up to 20 places at once, and says when more match", async () => {
    const word = randomUUID().slice(0, 8);
    for (let made = 0; made < 21; made++) await listedPlace(word);

    const found = await callTool("search_places", { text: word });
    expect(found.payload).toMatchObject({ moreMatch: true });
    expect((found.payload as { places: unknown[] }).places).toHaveLength(20);
  });

  it("checks one place's dates: free or taken, priced, and why a stay does not fit", async () => {
    const { business, ctx, room } = await listedPlace();
    const closed = stay(30, 2);
    await addBlock(ctx, { roomId: room.id, range: closed, note: null });

    const taken = await callTool("check_availability", {
      slug: business.slug,
      checkIn: toIsoDate(closed.checkIn),
      checkOut: toIsoDate(closed.checkOut),
    });
    expect(taken.payload).toMatchObject({
      units: [{ roomId: room.id, free: false, issue: null, total: "$240.00" }],
    });

    const short = stay(40, 1);
    const tooShort = await callTool("check_availability", {
      slug: business.slug,
      checkIn: toIsoDate(short.checkIn),
      checkOut: toIsoDate(short.checkOut),
    });
    expect(tooShort.payload).toMatchObject({ units: [{ free: true, issue: "MIN_NIGHTS" }] });

    const backwards = await callTool("check_availability", {
      slug: business.slug,
      checkIn: toIsoDate(short.checkOut),
      checkOut: toIsoDate(short.checkIn),
    });
    expect(backwards.isError).toBe(true);
  });

  it("reads a place's public page with its host, and nothing only its host may see", async () => {
    const { business, owner, room } = await listedPlace();
    await prisma.business.update({ where: { id: business.id }, data: { whatsapp: "+96170123456" } });
    await prisma.hostProfile.create({
      data: {
        userId: owner.id,
        displayName: "Rania",
        bio: "I grew up in this house.",
        languages: ["en", "ar"],
        hostingSince: 2019,
        showOnListings: true,
      },
    });
    const place = await callTool("get_place", { slug: business.slug });
    expect(place.payload).toMatchObject({
      slug: business.slug,
      bookedAs: "room by room",
      host: {
        name: "Rania",
        about: "I grew up in this house.",
        languages: ["en", "ar"],
        yearsHosting: new Date().getUTCFullYear() - 2019,
        whatsapp: "+96170123456",
        contactPage: expect.stringContaining(`/p/${business.slug}/contact`),
      },
    });
    const text = JSON.stringify(place.payload);
    for (const secret of ["Whish 03 123 456", "commission", "exportToken", room.exportToken, business.id]) {
      expect(text).not.toContain(secret);
    }

    // A host who takes WhatsApp only is not offered the Contact host page, as on the place's page.
    await prisma.hostProfile.update({ where: { userId: owner.id }, data: { contactBy: "WHATSAPP" } });
    expect((await callTool("get_place", { slug: business.slug })).payload).toMatchObject({
      host: { whatsapp: "+96170123456", contactPage: null },
    });

    expect(await callTool("get_place", { slug: "no-such-place" })).toMatchObject({
      isError: true,
      payload: { error: "Place not found" },
    });
  });

  it("limits how often one address may call it", async () => {
    const address = "198.51.100.9";
    for (let call = 0; call < 30; call++) await callTool("get_place", { slug: "no-such-place" }, address);
    expect((await callTool("get_place", { slug: "no-such-place" }, address)).status).toBe(429);
  });
});
