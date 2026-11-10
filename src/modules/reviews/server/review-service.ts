import { getBookingForGuest } from "@/modules/bookings/server";
import { duplicateAsConflict } from "@/server/db/constraint-errors";
import { prisma } from "@/server/db/client";
import { forbidden, notFound } from "@/server/errors";
import { toIsoDate, todayUtc } from "@/utils/dates";
import { averageRating } from "../rating";
import type { NewReview } from "../schemas";
import type { PlaceRating, PlaceReview } from "../types";
import * as reviews from "./review-repository";

// Reviews: who may write one, and what a place's page shows. One stay, one review, written once the stay is over.

/**
 * A guest's review of the stay they had. Only the guest whose stay it was (the booking's private link is theirs
 * alone), only a stay that was confirmed, and only after they have checked out: a stay that was declined, expired,
 * cancelled or has not ended yet cannot be reviewed. The second review of one booking is refused by the database
 * itself, so two taps on the button cannot leave two.
 */
export async function writeReview(
  guestUserId: string,
  publicToken: string,
  input: NewReview,
  now: Date = new Date(),
): Promise<void> {
  const booking = await getBookingForGuest(publicToken, guestUserId);
  if (!booking) throw notFound("Booking");
  if (booking.status !== "CONFIRMED") throw forbidden("Only a stay that went ahead can be reviewed");
  if (toIsoDate(booking.checkOut) > toIsoDate(todayUtc(now))) {
    throw forbidden("You can write your review once your stay is over");
  }
  await duplicateAsConflict("You have already reviewed this stay", () =>
    reviews.createReview(prisma, {
      businessId: booking.businessId,
      roomId: booking.roomId,
      bookingId: booking.id,
      authorId: guestUserId,
      rating: input.rating,
      comment: input.comment,
    }),
  );
}

/** What a place's page shows: its published reviews, newest first. */
export async function listPlaceReviews(businessId: string): Promise<PlaceReview[]> {
  const rows = await reviews.listPublishedReviews(prisma, businessId);
  return rows.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    ownerReply: review.ownerReply,
    writtenOn: toIsoDate(review.createdAt),
    // A guest who closed their account keeps their review and loses their name.
    authorName: review.author && !review.author.isDeleted ? review.author.name : null,
  }));
}

/** A place's stars and how many guests gave them. */
export async function getPlaceRating(businessId: string): Promise<PlaceRating> {
  const ratings = await reviews.listRatings(prisma, businessId);
  return { average: averageRating(ratings), count: ratings.length };
}

/** Which of these bookings their guest has already reviewed, so a stay is never offered the form twice. */
export function findReviewedBookings(bookingIds: readonly string[]): Promise<Set<string>> {
  return reviews.findReviewedBookingIds(prisma, bookingIds);
}
