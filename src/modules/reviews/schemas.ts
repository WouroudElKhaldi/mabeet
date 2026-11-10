import { z } from "zod";
import { id, workspaceParams } from "@/lib/schemas";
import { MAX_RATING, MIN_RATING } from "./rating";

/**
 * A guest's review of the stay they had: one overall rating and what they want the next guest to know. There are
 * no sub-ratings (cleanliness, location, value): one place, one number.
 */
export const newReview = z.object({
  rating: z.number().int().min(MIN_RATING).max(MAX_RATING),
  comment: z.string().trim().min(10).max(2000),
});

export type NewReview = z.infer<typeof newReview>;

/** One review of a place, in the dashboard's addresses. */
export const reviewParams = workspaceParams.extend({ reviewId: id });

/** The host's public answer under a review; empty takes it away. */
export const reviewReply = z.object({
  reply: z.string().trim().max(1000),
});

/**
 * Whether guests see a review. Hiding needs a reason the team will read later (the review is never deleted, and it
 * stops counting toward the place's rating); showing it again clears the reason.
 */
export const reviewVisibility = z.discriminatedUnion("hidden", [
  z.object({ hidden: z.literal(true), reason: z.string().trim().min(3).max(500) }),
  z.object({ hidden: z.literal(false) }),
]);

export type ReviewReply = z.infer<typeof reviewReply>;
export type ReviewVisibility = z.infer<typeof reviewVisibility>;
