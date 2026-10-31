import { describe, expect, it } from "vitest";
import {
  type Db,
  isOverlapError,
  isUniqueViolation,
  prisma,
  runInTransaction,
  type Tx,
} from "@/server/db/client";
import { duplicateAsConflict, overlapAsConflict } from "@/server/db/constraint-errors";
import { parseIsoDate } from "@/utils/dates";
import { secureToken } from "@/utils/tokens";

const businessesNamed = (db: Db, name: string) => db.business.count({ where: { name } });

const createPlace = async (db: Db, name: string) => {
  const business = await db.business.create({ data: { name, slug: `place-${secureToken(6)}` } });
  const room = await db.room.create({
    data: { businessId: business.id, name: "Arched room", baseRateCents: 9_000, exportToken: secureToken() },
  });
  return { business, room };
};

const closeNights = (
  db: Db,
  place: Awaited<ReturnType<typeof createPlace>>,
  checkIn: string,
  checkOut: string,
) =>
  db.occupancy.create({
    data: {
      businessId: place.business.id,
      roomId: place.room.id,
      checkIn: parseIsoDate(checkIn),
      checkOut: parseIsoDate(checkOut),
      kind: "MANUAL",
    },
  });

describe("all or nothing", () => {
  it("undoes the first step when a later step fails, so nothing is half saved", async () => {
    const name = `Dar Al Sindiyan ${secureToken(4)}`;
    await expect(
      runInTransaction(async (tx: Tx) => {
        await createPlace(tx, name);
        expect(await businessesNamed(tx, name)).toBe(1);
        throw new Error("step 2 failed");
      }),
    ).rejects.toThrow("step 2 failed");
    expect(await businessesNamed(prisma, name)).toBe(0);
  });

  it("keeps every step when they all succeed", async () => {
    const name = `Ehden Stone House ${secureToken(4)}`;
    await runInTransaction((tx) => createPlace(tx, name));
    expect(await businessesNamed(prisma, name)).toBe(1);
  });
});

describe("database refusals", () => {
  it("recognises a second copy of something unique", async () => {
    const { business } = await createPlace(prisma, "Beit Batroun");
    const error = await prisma.business
      .create({ data: { name: "Another place", slug: business.slug } })
      .catch((caught: unknown) => caught);
    expect(isUniqueViolation(error)).toBe(true);
    expect(isOverlapError(error)).toBe(false);
  });

  it("recognises two stays on the same room night, and lets back-to-back stays through", async () => {
    const place = await createPlace(prisma, "Beyt El Jabal");
    await closeNights(prisma, place, "2026-11-12", "2026-11-15");
    await expect(closeNights(prisma, place, "2026-11-15", "2026-11-17")).resolves.toBeDefined();
    const error = await closeNights(prisma, place, "2026-11-14", "2026-11-16").catch(
      (caught: unknown) => caught,
    );
    expect(isOverlapError(error)).toBe(true);
    expect(isUniqueViolation(error)).toBe(false);
  });
});

describe("turning a refusal into a clear answer", () => {
  it("answers two stays on one room night with 409 and the message people read", async () => {
    const place = await createPlace(prisma, "Casadar");
    await closeNights(prisma, place, "2026-12-01", "2026-12-04");
    await expect(
      overlapAsConflict("Those dates were just taken", () =>
        closeNights(prisma, place, "2026-12-03", "2026-12-05"),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "Those dates were just taken" });
  });

  it("answers a second copy with 409, and lets any other error through unchanged", async () => {
    const { business } = await createPlace(prisma, "Beit El Qamar");
    await expect(
      duplicateAsConflict("This link is taken", () =>
        prisma.business.create({ data: { name: "Copy", slug: business.slug } }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      duplicateAsConflict("This link is taken", () => Promise.reject(new Error("network down"))),
    ).rejects.toThrow("network down");
  });
});
