// What a place's ratings add up to. Pure: the same numbers on the server, in a card and in a test.

/** Ratings are whole stars, 1 to 5. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

/** The stars a place shows, to one decimal (4.8), or null until a guest has rated it. */
export function averageRating(ratings: readonly number[]): number | null {
  if (ratings.length === 0) return null;
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return Math.round((total / ratings.length) * 10) / 10;
}

/** How many whole stars to fill for a rating, so 4.8 shows five and 4.4 shows four. */
export const filledStars = (rating: number): number => Math.round(rating);
