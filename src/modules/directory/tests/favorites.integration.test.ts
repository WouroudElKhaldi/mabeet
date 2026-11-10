import { afterEach, describe, expect, it } from "vitest";
import * as favoriteRoute from "@/app/api/me/favorites/[slug]/route";
import { addRoom, createPlace, createUser, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { isPlaceSaved, listMyFavorites, setFavorite } from "../server";

// A guest's saved places, on the real database: saving, unsaving, saving again, and what the list shows.

/** A listed place with one room, so it can appear as a card. */
async function listedPlace(name: string, rate = 9_000) {
  const place = await createPlace(name);
  await prisma.business.update({
    where: { id: place.business.id },
    data: { listedPublicly: true, area: "Bsharri", currency: "USD" },
  });
  await addRoom(place.business.id, { baseRateCents: rate });
  return place;
}

describe("saving a place", () => {
  it("keeps it for this guest, and for nobody else", async () => {
    const place = await listedPlace("Beit Cedar");
    const guest = await createUser("Maya");
    const other = await createUser("Sami");

    await setFavorite(guest.id, place.business.slug, true);

    expect(await isPlaceSaved(guest.id, place.business.slug)).toBe(true);
    expect(await isPlaceSaved(other.id, place.business.slug)).toBe(false);
    expect((await listMyFavorites(guest.id)).map((card) => card.slug)).toEqual([place.business.slug]);
    expect(await listMyFavorites(other.id)).toEqual([]);
  });

  it("twice is the same as once: one row, saved", async () => {
    const place = await listedPlace("Beit Cedar");
    const guest = await createUser("Maya");

    await setFavorite(guest.id, place.business.slug, true);
    await setFavorite(guest.id, place.business.slug, true);

    expect(await prisma.favorite.count({ where: { userId: guest.id } })).toBe(1);
    expect(await isPlaceSaved(guest.id, place.business.slug)).toBe(true);
  });

  it("then unsaving keeps the row and marks it, so saving again brings the same one back", async () => {
    const place = await listedPlace("Beit Cedar");
    const guest = await createUser("Maya");

    await setFavorite(guest.id, place.business.slug, true);
    await setFavorite(guest.id, place.business.slug, false);
    expect(await isPlaceSaved(guest.id, place.business.slug)).toBe(false);
    expect(await listMyFavorites(guest.id)).toEqual([]);
    expect(await prisma.favorite.count({ where: { userId: guest.id } })).toBe(1);

    await setFavorite(guest.id, place.business.slug, true);
    expect(await isPlaceSaved(guest.id, place.business.slug)).toBe(true);
    expect(await prisma.favorite.count({ where: { userId: guest.id } })).toBe(1);
  });

  it("unsaving one that was never saved changes nothing", async () => {
    const place = await listedPlace("Beit Cedar");
    const guest = await createUser("Maya");
    await setFavorite(guest.id, place.business.slug, false);
    expect(await prisma.favorite.count({ where: { userId: guest.id } })).toBe(0);
  });

  it("is refused for a place that does not exist, or is paused", async () => {
    const guest = await createUser("Maya");
    const paused = await listedPlace("Beit Paused");
    await prisma.business.update({ where: { id: paused.business.id }, data: { status: "SUSPENDED" } });

    await expect(setFavorite(guest.id, "no-such-place", true)).rejects.toMatchObject({ status: 404 });
    await expect(setFavorite(guest.id, paused.business.slug, true)).rejects.toMatchObject({ status: 404 });
    expect(await isPlaceSaved(guest.id, "no-such-place")).toBe(false);
  });
});

describe("the saved list", () => {
  it("shows the newest first, with a night's price and no stay", async () => {
    const first = await listedPlace("Beit One", 8_000);
    const second = await listedPlace("Beit Two", 12_000);
    const guest = await createUser("Maya");

    await setFavorite(guest.id, first.business.slug, true);
    await setFavorite(guest.id, second.business.slug, true);

    const cards = await listMyFavorites(guest.id);
    expect(cards.map((card) => card.name)).toEqual(["Beit Two", "Beit One"]);
    expect(cards[0]).toMatchObject({
      area: "Bsharri",
      currency: "USD",
      nightlyFromCents: 12_000,
      stayTotalFromCents: null,
    });
  });

  it("keeps a place its owner unlisted (its page still works), but drops a paused one", async () => {
    const unlisted = await listedPlace("Beit Unlisted");
    const paused = await listedPlace("Beit Paused");
    const guest = await createUser("Maya");
    await setFavorite(guest.id, unlisted.business.slug, true);
    await setFavorite(guest.id, paused.business.slug, true);

    await prisma.business.update({ where: { id: unlisted.business.id }, data: { listedPublicly: false } });
    await prisma.business.update({ where: { id: paused.business.id }, data: { status: "SUSPENDED" } });

    expect((await listMyFavorites(guest.id)).map((card) => card.name)).toEqual(["Beit Unlisted"]);
  });

  it("leaves out a place whose rooms are all gone, because there is no price to show", async () => {
    const place = await listedPlace("Beit Cedar");
    const guest = await createUser("Maya");
    await setFavorite(guest.id, place.business.slug, true);
    await prisma.room.updateMany({ where: { businessId: place.business.id }, data: { isDeleted: true } });
    expect(await listMyFavorites(guest.id)).toEqual([]);
  });

  it("is empty for a guest who saved nothing", async () => {
    const guest = await createUser("Maya");
    expect(await listMyFavorites(guest.id)).toEqual([]);
  });
});

describe("the heart's route", () => {
  afterEach(() => {
    resetMemoryRateLimits();
  });

  it("saves and unsaves for the signed-in guest", async () => {
    const place = await listedPlace("Beit Cedar");
    const guest = await signUp("Maya");
    const params = { slug: place.business.slug };

    expect(await call(favoriteRoute.PUT, { as: guest, method: "PUT", params })).toEqual({
      status: 200,
      body: { saved: true },
    });
    expect(await isPlaceSaved(guest.userId, place.business.slug)).toBe(true);

    expect(await call(favoriteRoute.DELETE, { as: guest, method: "DELETE", params })).toEqual({
      status: 200,
      body: { saved: false },
    });
    expect(await isPlaceSaved(guest.userId, place.business.slug)).toBe(false);
  });

  it("asks a signed-out visitor to sign in, and saves nothing", async () => {
    const place = await listedPlace("Beit Cedar");
    const response = await call(favoriteRoute.PUT, { method: "PUT", params: { slug: place.business.slug } });
    expect(response.status).toBe(401);
    // This place's own count: the tests above this one share the database and have saved places of their own.
    expect(await prisma.favorite.count({ where: { businessId: place.business.id } })).toBe(0);
  });

  it("does not know a place that is gone", async () => {
    const guest = await signUp("Maya");
    const response = await call(favoriteRoute.PUT, {
      as: guest,
      method: "PUT",
      params: { slug: "no-such-place" },
    });
    expect(response.status).toBe(404);
  });
});
