import { describe, expect, it } from "vitest";
import { addRoom, createPlace, createUser, memberWith, prisma } from "@tests/integration/helpers";
import { addDays, todayUtc } from "@/utils/dates";
import {
  getPlaceRating,
  listPlaceReviews,
  listTeamReviews,
  replyToReview,
  setReviewVisibility,
  writeReview,
} from "../server";

// The place's team and its reviews: every review, hidden ones included, answered or hidden with a reason, and only
// by a member whose role allows it.

const NOW = new Date("2026-11-20T12:00:00Z");

/** A place with a confirmed stay its guest has reviewed. */
async function reviewedPlace(rating = 4) {
  const place = await createPlace("Beit Reviews");
  const room = await addRoom(place.business.id);
  const guest = await createUser("Maya Haddad");
  const checkOut = addDays(todayUtc(NOW), -3);
  const booking = await prisma.booking.create({
    data: {
      reference: `MB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      publicToken: crypto.randomUUID(),
      businessId: place.business.id,
      roomId: room.id,
      guestUserId: guest.id,
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
  await writeReview(guest.id, booking.publicToken, { rating, comment: "Quiet nights and a kind host." }, NOW);
  const [review] = await listTeamReviews(place.ctx);
  if (!review) throw new Error("The review was not written");
  return { place, room, booking, review };
}

describe("the team's reviews", () => {
  it("lists every review with the stay it was about", async () => {
    const { room, booking, review } = await reviewedPlace();
    expect(review).toMatchObject({
      rating: 4,
      authorName: "Maya Haddad",
      status: "PUBLISHED",
      hiddenReason: null,
      roomName: room.name,
      bookingReference: booking.reference,
    });
  });

  it("shows the host's reply on the place's page, and takes it away when emptied", async () => {
    const { place, review } = await reviewedPlace();

    await replyToReview(place.ctx, review.id, { reply: "Thank you, come back in spring!" });
    expect((await listPlaceReviews(place.business.id))[0]?.ownerReply).toBe(
      "Thank you, come back in spring!",
    );

    await replyToReview(place.ctx, review.id, { reply: "" });
    expect((await listPlaceReviews(place.business.id))[0]?.ownerReply).toBeNull();
    expect(
      await prisma.auditLog.findMany({
        where: { entityId: review.id },
        select: { action: true },
        orderBy: { createdAt: "asc" },
      }),
    ).toEqual([{ action: "review.replied" }, { action: "review.reply_removed" }]);
  });

  it("hides a review from guests with a reason, keeps it for the team, and shows it again", async () => {
    const { place, review } = await reviewedPlace(1);

    await setReviewVisibility(place.ctx, review.id, { hidden: true, reason: "Written about another place" });
    expect(await listPlaceReviews(place.business.id)).toEqual([]);
    expect(await getPlaceRating(place.business.id)).toEqual({ average: null, count: 0 });
    expect((await listTeamReviews(place.ctx))[0]).toMatchObject({
      status: "HIDDEN",
      hiddenReason: "Written about another place",
    });

    await setReviewVisibility(place.ctx, review.id, { hidden: false });
    expect(await getPlaceRating(place.business.id)).toEqual({ average: 1, count: 1 });
    expect((await listTeamReviews(place.ctx))[0]).toMatchObject({ status: "PUBLISHED", hiddenReason: null });
  });

  it("is refused to a member whose role does not allow it", async () => {
    const { place, review } = await reviewedPlace();
    const staff = await memberWith(place.business.id, ["bookings.read"]);

    await expect(listTeamReviews(staff)).rejects.toMatchObject({ status: 403 });
    await expect(replyToReview(staff, review.id, { reply: "Hello" })).rejects.toMatchObject({ status: 403 });
    await expect(setReviewVisibility(staff, review.id, { hidden: false })).rejects.toMatchObject({
      status: 403,
    });

    const replier = await memberWith(place.business.id, ["reviews.reply"]);
    await replyToReview(replier, review.id, { reply: "Thank you!" });
  });

  it("never reaches another place's review", async () => {
    const { review } = await reviewedPlace();
    const other = await createPlace("Another place");

    await expect(replyToReview(other.ctx, review.id, { reply: "Not ours" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      setReviewVisibility(other.ctx, review.id, { hidden: true, reason: "Not ours either" }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await listTeamReviews(other.ctx)).toEqual([]);
  });
});
