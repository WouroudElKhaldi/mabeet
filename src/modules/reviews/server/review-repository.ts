import type { Db } from "@/server/db/client";

// The reviews table. Only this file reads or writes it.

/** Writes a guest's review of their stay. The booking is unique on the row, so a second one is refused there. */
export function createReview(
  db: Db,
  review: {
    businessId: string;
    roomId: string;
    bookingId: string;
    authorId: string;
    rating: number;
    comment: string;
  },
) {
  return db.review.create({ data: review });
}

/** A place's published reviews, newest first, with the author's name unless they have closed their account. */
export function listPublishedReviews(db: Db, businessId: string) {
  return db.review.findMany({
    where: { businessId, status: "PUBLISHED", isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      ownerReply: true,
      createdAt: true,
      author: { select: { name: true, isDeleted: true } },
    },
  });
}

/** Every published rating of a place, for its average. */
export async function listRatings(db: Db, businessId: string): Promise<number[]> {
  const reviews = await db.review.findMany({
    where: { businessId, status: "PUBLISHED", isDeleted: false },
    select: { rating: true },
  });
  return reviews.map((review) => review.rating);
}

/** Which of these bookings their guest has already reviewed. */
export async function findReviewedBookingIds(db: Db, bookingIds: readonly string[]): Promise<Set<string>> {
  if (bookingIds.length === 0) return new Set();
  const reviews = await db.review.findMany({
    where: { bookingId: { in: [...bookingIds] }, isDeleted: false },
    select: { bookingId: true },
  });
  return new Set(reviews.flatMap((review) => (review.bookingId ? [review.bookingId] : [])));
}
