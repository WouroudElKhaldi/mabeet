import { describe, expect, it } from "vitest";
import { addRoom, createPlace, createUser, prisma } from "@tests/integration/helpers";
import { writeReview } from "@/modules/reviews/server";
import { addDays, todayUtc } from "@/utils/dates";
import { listMyActivity, setFavorite } from "../server";

// A guest's own timeline on the real database: what goes on it, what it says, where each line leads, and that it
// is theirs alone.

const NOW = new Date("2026-11-20T12:00:00Z");

async function listedPlace(name: string) {
  const place = await createPlace(name);
  await prisma.business.update({
    where: { id: place.business.id },
    data: { listedPublicly: true, area: "Batroun", currency: "USD" },
  });
  const room = await addRoom(place.business.id);
  return { ...place, room };
}

/** A confirmed stay that ended a few days before NOW, written straight to the database. */
function pastStay(place: Awaited<ReturnType<typeof listedPlace>>, guestId: string) {
  const checkOut = addDays(todayUtc(NOW), -3);
  return prisma.booking.create({
    data: {
      reference: `MB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      publicToken: crypto.randomUUID(),
      businessId: place.business.id,
      roomId: place.room.id,
      guestUserId: guestId,
      guestName: "Maya Haddad",
      guestPhone: "+96171123456",
      guestCount: 2,
      checkIn: addDays(checkOut, -2),
      checkOut,
      totalCents: 18_000,
      currency: "USD",
      bookingMode: "OFFLINE",
      status: "CONFIRMED",
    },
  });
}

describe("a guest's activity", () => {
  it("tells what they saved and reviewed, newest first, each line leading to its page", async () => {
    const place = await listedPlace("Beit Batroun");
    const guest = await createUser("Maya Haddad");
    const booking = await pastStay(place, guest.id);

    await setFavorite(guest.id, place.business.slug, true);
    await writeReview(
      guest.id,
      booking.publicToken,
      { rating: 5, comment: "Lovely old stone house by the sea." },
      NOW,
    );

    expect(await listMyActivity(guest.id)).toEqual([
      expect.objectContaining({
        action: "review.written",
        placeName: "Beit Batroun",
        href: `/b/${booking.publicToken}`,
        reference: booking.reference,
      }),
      expect.objectContaining({
        action: "favorite.saved",
        placeName: "Beit Batroun",
        href: `/p/${place.business.slug}`,
        reference: null,
      }),
    ]);
  });

  it("adds a line only when a heart really changes", async () => {
    const place = await listedPlace("Beit Hearts");
    const guest = await createUser("Maya");

    await setFavorite(guest.id, place.business.slug, true);
    await setFavorite(guest.id, place.business.slug, true);
    await setFavorite(guest.id, place.business.slug, false);
    await setFavorite(guest.id, place.business.slug, false);

    expect((await listMyActivity(guest.id)).map((item) => item.action)).toEqual([
      "favorite.removed",
      "favorite.saved",
    ]);
  });

  it("is the guest's own, and leaves out what the page does not tell", async () => {
    const place = await listedPlace("Beit Private");
    const guest = await createUser("Maya");
    const other = await createUser("Sami");
    await setFavorite(guest.id, place.business.slug, true);
    await prisma.activityLog.create({
      data: {
        userId: guest.id,
        action: "something.internal",
        entity: "business",
        entityId: place.business.id,
      },
    });

    expect((await listMyActivity(guest.id)).map((item) => item.action)).toEqual(["favorite.saved"]);
    expect(await listMyActivity(other.id)).toEqual([]);
  });

  it("keeps the line of a place that has closed since, without a link", async () => {
    const place = await listedPlace("Beit Gone");
    const guest = await createUser("Maya");
    await setFavorite(guest.id, place.business.slug, true);
    await prisma.business.update({ where: { id: place.business.id }, data: { status: "SUSPENDED" } });

    expect(await listMyActivity(guest.id)).toEqual([
      expect.objectContaining({ action: "favorite.saved", placeName: null, href: null }),
    ]);
  });
});
