import { describe, expect, it } from "vitest";
import { addRoom, createPlace, createUser, prisma, stay } from "@tests/integration/helpers";
import { addDays, todayUtc } from "@/utils/dates";
import { getPlaceRating, listPlaceReviews, writeReview } from "../server";

// Who may review a stay, and what a place's page then shows. One stay, one review, once it is over.

const NOW = new Date("2026-11-20T12:00:00Z");

/** A booking written straight to the database, in whatever state the rule under test needs. */
async function stayOf(
  place: Awaited<ReturnType<typeof createPlace>>,
  roomId: string,
  guestId: string,
  {
    status = "CONFIRMED",
    endedDaysAgo = 7,
  }: { status?: "CONFIRMED" | "CANCELLED" | "DECLINED"; endedDaysAgo?: number } = {},
) {
  const checkOut = addDays(todayUtc(NOW), -endedDaysAgo);
  return prisma.booking.create({
    data: {
      reference: `MB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      publicToken: crypto.randomUUID(),
      businessId: place.business.id,
      roomId,
      guestUserId: guestId,
      guestName: "Maya Haddad",
      guestPhone: "+96171123456",
      guestCount: 2,
      checkIn: addDays(checkOut, -2),
      checkOut,
      totalCents: 18_000,
      currency: "USD",
      bookingMode: "OFFLINE",
      status,
    },
  });
}

const review = { rating: 5, comment: "The bread at breakfast alone is worth the drive." };

describe("writing a review", () => {
  it("is kept with the stay, and shows on the place's page", async () => {
    const place = await createPlace("Beit Cedar");
    const room = await addRoom(place.business.id);
    const guest = await createUser("Maya Haddad");
    const booking = await stayOf(place, room.id, guest.id);

    await writeReview(guest.id, booking.publicToken, review, NOW);

    const [shown, ...more] = await listPlaceReviews(place.business.id);
    expect(more).toEqual([]);
    expect(shown).toMatchObject({
      rating: 5,
      comment: review.comment,
      authorName: "Maya Haddad",
      ownerReply: null,
    });
    expect(await getPlaceRating(place.business.id)).toEqual({ average: 5, count: 1 });
  });

  it("is refused a second time for the same stay", async () => {
    const place = await createPlace();
    const room = await addRoom(place.business.id);
    const guest = await createUser("Maya");
    const booking = await stayOf(place, room.id, guest.id);

    await writeReview(guest.id, booking.publicToken, review, NOW);
    await expect(writeReview(guest.id, booking.publicToken, review, NOW)).rejects.toMatchObject({
      status: 409,
    });
    expect(await prisma.review.count({ where: { businessId: place.business.id } })).toBe(1);
  });

  it("is refused before the guest has checked out", async () => {
    const place = await createPlace();
    const room = await addRoom(place.business.id);
    const guest = await createUser("Maya");
    const range = stay(5, 2, NOW);
    const booking = await prisma.booking.create({
      data: {
        reference: "MB-FUTURE",
        publicToken: crypto.randomUUID(),
        businessId: place.business.id,
        roomId: room.id,
        guestUserId: guest.id,
        guestName: "Maya",
        guestPhone: "+96171123456",
        guestCount: 2,
        checkIn: range.checkIn,
        checkOut: range.checkOut,
        totalCents: 18_000,
        currency: "USD",
        bookingMode: "OFFLINE",
        status: "CONFIRMED",
      },
    });
    await expect(writeReview(guest.id, booking.publicToken, review, NOW)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("is refused for a stay that never went ahead", async () => {
    const place = await createPlace();
    const room = await addRoom(place.business.id);
    const guest = await createUser("Maya");
    for (const status of ["CANCELLED", "DECLINED"] as const) {
      const booking = await stayOf(place, room.id, guest.id, { status });
      await expect(writeReview(guest.id, booking.publicToken, review, NOW)).rejects.toMatchObject({
        status: 403,
      });
    }
    expect(await prisma.review.count({ where: { businessId: place.business.id } })).toBe(0);
  });

  it("is refused to anyone but the guest whose stay it was", async () => {
    const place = await createPlace();
    const room = await addRoom(place.business.id);
    const guest = await createUser("Maya");
    const stranger = await createUser("Sami");
    const booking = await stayOf(place, room.id, guest.id);

    await expect(writeReview(stranger.id, booking.publicToken, review, NOW)).rejects.toMatchObject({
      status: 404,
    });
    await expect(writeReview(guest.id, "no-such-token", review, NOW)).rejects.toMatchObject({ status: 404 });
  });
});

describe("a place's reviews", () => {
  it("average every rating, newest review first", async () => {
    const place = await createPlace();
    const room = await addRoom(place.business.id);
    for (const [index, rating] of [5, 4, 5].entries()) {
      const guest = await createUser(`Guest ${index}`);
      const booking = await stayOf(place, room.id, guest.id, { endedDaysAgo: 10 - index });
      await writeReview(guest.id, booking.publicToken, { ...review, rating }, NOW);
    }
    expect(await getPlaceRating(place.business.id)).toEqual({ average: 4.7, count: 3 });
    expect((await listPlaceReviews(place.business.id)).map((shown) => shown.rating)).toEqual([5, 4, 5]);
  });

  it("keeps the review of a guest who closed their account, without their name", async () => {
    const place = await createPlace();
    const room = await addRoom(place.business.id);
    const guest = await createUser("Maya");
    const booking = await stayOf(place, room.id, guest.id);
    await writeReview(guest.id, booking.publicToken, review, NOW);

    await prisma.user.update({ where: { id: guest.id }, data: { isDeleted: true } });

    const [shown] = await listPlaceReviews(place.business.id);
    expect(shown).toMatchObject({ comment: review.comment, authorName: null });
    expect(await getPlaceRating(place.business.id)).toEqual({ average: 5, count: 1 });
  });

  it("leaves out one the host hid, and counts only its own place", async () => {
    const place = await createPlace();
    const other = await createPlace();
    const room = await addRoom(place.business.id);
    const otherRoom = await addRoom(other.business.id);
    const guest = await createUser("Maya");

    const hidden = await stayOf(place, room.id, guest.id, { endedDaysAgo: 9 });
    await writeReview(guest.id, hidden.publicToken, { ...review, rating: 1 }, NOW);
    await prisma.review.updateMany({
      where: { bookingId: hidden.id },
      data: { status: "HIDDEN", hiddenReason: "Not about the stay" },
    });

    const elsewhere = await stayOf(other, otherRoom.id, guest.id, { endedDaysAgo: 8 });
    await writeReview(guest.id, elsewhere.publicToken, { ...review, rating: 2 }, NOW);

    const kept = await stayOf(place, room.id, guest.id, { endedDaysAgo: 7 });
    await writeReview(guest.id, kept.publicToken, { ...review, rating: 4 }, NOW);

    expect(await getPlaceRating(place.business.id)).toEqual({ average: 4, count: 1 });
    expect((await listPlaceReviews(place.business.id)).map((shown) => shown.rating)).toEqual([4]);
  });

  it("has nothing to show for a place nobody has reviewed", async () => {
    const place = await createPlace();
    expect(await listPlaceReviews(place.business.id)).toEqual([]);
    expect(await getPlaceRating(place.business.id)).toEqual({ average: null, count: 0 });
  });
});
