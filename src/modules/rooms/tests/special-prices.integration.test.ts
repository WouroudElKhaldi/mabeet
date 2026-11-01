import { beforeEach, describe, expect, it } from "vitest";
import { createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { specialPriceInput } from "../schemas";
import { createRoom, listSpecialPrices, setSpecialPrice } from "../server/room-service";

// Every test runs on a fixed day, so the "from today on" list never depends on when the tests run.
const NOW = new Date("2026-11-01T10:00:00Z");

describe("special prices", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;
  let roomId: string;

  beforeEach(async () => {
    place = await createPlace();
    const room = await createRoom(place.ctx, {
      name: "Cedar room",
      capacity: 2,
      baseRateCents: 8500,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      minNights: 1,
      amenities: [],
      active: true,
    });
    roomId = room.id;
  });

  const setPrice = (checkIn: string, checkOut: string, rateCents: number | null) =>
    setSpecialPrice(place.ctx, roomId, { checkIn, checkOut, rateCents }, NOW);

  it("prices those nights only, the check-out night excluded", async () => {
    expect(await setPrice("2026-12-24", "2026-12-27", 12000)).toEqual([
      { checkIn: "2026-12-24", checkOut: "2026-12-27", rateCents: 12000 },
    ]);
    const nights = await prisma.rateOverride.findMany({ where: { roomId, isDeleted: false } });
    expect(nights.map((night) => night.date.toISOString().slice(0, 10)).sort()).toEqual([
      "2026-12-24",
      "2026-12-25",
      "2026-12-26",
    ]);
  });

  it("replaces an earlier price on the nights it covers, and keeps one row per night", async () => {
    await setPrice("2026-12-24", "2026-12-27", 12000);
    expect(await setPrice("2026-12-25", "2026-12-26", 15000)).toEqual([
      { checkIn: "2026-12-24", checkOut: "2026-12-25", rateCents: 12000 },
      { checkIn: "2026-12-25", checkOut: "2026-12-26", rateCents: 15000 },
      { checkIn: "2026-12-26", checkOut: "2026-12-27", rateCents: 12000 },
    ]);
    expect(await prisma.rateOverride.count({ where: { roomId } })).toBe(3);
  });

  it("goes back to the base price when cleared, and brings the same row back when set again", async () => {
    await setPrice("2026-12-24", "2026-12-27", 12000);
    expect(await setPrice("2026-12-24", "2026-12-27", null)).toEqual([]);
    expect(await setPrice("2026-12-25", "2026-12-26", 9000)).toEqual([
      { checkIn: "2026-12-25", checkOut: "2026-12-26", rateCents: 9000 },
    ]);
    expect(await prisma.rateOverride.count({ where: { roomId } })).toBe(3);
  });

  it("lists only nights from today on", async () => {
    await setPrice("2026-10-30", "2026-11-03", 11000);
    expect(await listSpecialPrices(place.ctx, roomId, NOW)).toEqual([
      { checkIn: "2026-11-01", checkOut: "2026-11-03", rateCents: 11000 },
    ]);
  });

  it("keeps an LBP price above the 32-bit limit exact", async () => {
    expect(await setPrice("2026-12-24", "2026-12-25", 2_250_000_000)).toEqual([
      { checkIn: "2026-12-24", checkOut: "2026-12-25", rateCents: 2_250_000_000 },
    ]);
  });

  it("needs rooms.manage to change and rooms.read to see", async () => {
    const reader = await memberWith(place.business.id, ["rooms.read"]);
    await expect(
      setSpecialPrice(reader, roomId, { checkIn: "2026-12-24", checkOut: "2026-12-25", rateCents: 1 }, NOW),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listSpecialPrices(reader, roomId, NOW)).resolves.toEqual([]);

    const outsider = await memberWith(place.business.id, ["bookings.read"]);
    await expect(listSpecialPrices(outsider, roomId, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("answers 404 for another business's room, and saves nothing", async () => {
    const other = await createPlace("Beit Other");
    await expect(
      setSpecialPrice(
        other.ctx,
        roomId,
        { checkIn: "2026-12-24", checkOut: "2026-12-25", rateCents: 1 },
        NOW,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.rateOverride.count({ where: { roomId } })).toBe(0);
  });

  it("refuses more than 366 nights, check-out before check-in, and a broken date", () => {
    const parse = (checkIn: string, checkOut: string) =>
      specialPriceInput.safeParse({ checkIn, checkOut, rateCents: 10000 }).success;
    expect(parse("2027-01-01", "2028-01-02")).toBe(true); // 366 nights
    expect(parse("2027-01-01", "2028-01-03")).toBe(false);
    expect(parse("2027-01-05", "2027-01-05")).toBe(false);
    expect(parse("2027-02-30", "2027-03-02")).toBe(false);
    expect(specialPriceInput.safeParse({ checkIn: "2027-01-01", checkOut: "2027-01-02" }).success).toBe(
      false,
    );
  });
});
