import { notePerson, recordAction } from "@/modules/audit/server";
import { getBookingForGuest } from "@/modules/bookings/server";
import { requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { duplicateAsConflict } from "@/server/db/constraint-errors";
import { prisma, runInTransaction } from "@/server/db/client";
import { forbidden, notFound } from "@/server/errors";
import { toIsoDate, todayUtc } from "@/utils/dates";
import { averageRating } from "../rating";
import type { NewReview, ReviewReply, ReviewVisibility } from "../schemas";
import type { PlaceRating, PlaceReview, TeamReview } from "../types";
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
    runInTransaction(async (tx) => {
      await reviews.createReview(tx, {
        businessId: booking.businessId,
        roomId: booking.roomId,
        bookingId: booking.id,
        authorId: guestUserId,
        rating: input.rating,
        comment: input.comment,
      });
      await notePerson(tx, {
        userId: guestUserId,
        businessId: booking.businessId,
        action: "review.written",
        entity: "booking",
        entityId: booking.id,
      });
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
    authorName: authorNameOf(review.author),
  }));
}

/** What an experience or service's page shows: its own published reviews, newest first. */
export async function listOfferingReviews(offeringId: string): Promise<PlaceReview[]> {
  const rows = await reviews.listPublishedOfferingReviews(prisma, offeringId);
  return rows.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    ownerReply: review.ownerReply,
    writtenOn: toIsoDate(review.createdAt),
    authorName: authorNameOf(review.author),
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

/** A guest's name on a review, or null once they have closed their account. */
function authorNameOf(author: { name: string; isDeleted: boolean } | null): string | null {
  return author && !author.isDeleted ? author.name : null;
}

/** Every review of the place for its team, hidden ones included, newest first. */
export async function listTeamReviews(ctx: TenantContext): Promise<TeamReview[]> {
  requirePermission(ctx, "reviews.reply");
  const rows = await reviews.listBusinessReviews(prisma, ctx.businessId);
  return rows.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    ownerReply: review.ownerReply,
    writtenOn: toIsoDate(review.createdAt),
    authorName: authorNameOf(review.author),
    status: review.status,
    hiddenReason: review.hiddenReason,
    roomName: review.room?.name ?? null,
    bookingReference: review.booking?.reference ?? null,
  }));
}

/** The host's public answer under a review, shown on the place's page; an empty answer takes it away. */
export async function replyToReview(ctx: TenantContext, reviewId: string, input: ReviewReply): Promise<void> {
  requirePermission(ctx, "reviews.reply");
  const ownerReply = input.reply === "" ? null : input.reply;
  const updated = await reviews.updateBusinessReview(prisma, ctx.businessId, reviewId, { ownerReply });
  if (!updated) throw notFound("Review");
  await recordAction(ctx, ownerReply ? "review.replied" : "review.reply_removed", "review", reviewId);
}

/**
 * Hides a review from guests, with the reason the team gives, or shows it again. A hidden review is kept, never
 * deleted, and counts for nothing on the place's page, not even its rating.
 */
export async function setReviewVisibility(
  ctx: TenantContext,
  reviewId: string,
  input: ReviewVisibility,
): Promise<void> {
  requirePermission(ctx, "reviews.reply");
  const change = input.hidden
    ? ({ status: "HIDDEN", hiddenReason: input.reason } as const)
    : ({ status: "PUBLISHED", hiddenReason: null } as const);
  const updated = await reviews.updateBusinessReview(prisma, ctx.businessId, reviewId, change);
  if (!updated) throw notFound("Review");
  await recordAction(ctx, input.hidden ? "review.hidden" : "review.shown", "review", reviewId);
}
