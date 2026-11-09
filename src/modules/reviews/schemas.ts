import { z } from "zod";
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
