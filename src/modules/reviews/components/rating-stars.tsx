import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { filledStars, MAX_RATING } from "../rating";
import type { PlaceRating } from "../types";

/** The stars themselves, filled up to the rating. Decoration: the number beside them is what is read out. */
export function Stars({ rating, className = "size-4" }: { rating: number; className?: string }) {
  const filled = filledStars(rating);
  return (
    <span aria-hidden className="inline-flex gap-0.5 text-accent">
      {Array.from({ length: MAX_RATING }, (_, index) => (
        <Star
          key={index}
          className={className}
          fill={index < filled ? "currentColor" : "none"}
          strokeWidth={1.8}
        />
      ))}
    </span>
  );
}

/**
 * A place's rating in one line: the stars, the number, and how many guests gave it. A place nobody has reviewed
 * says so instead, because no stars at all reads better than five empty ones.
 */
export async function RatingLine({ rating, className }: { rating: PlaceRating; className?: string }) {
  const t = await getTranslations("reviews");
  if (rating.average === null) return <p className={className}>{t("none")}</p>;
  return (
    <p className={`flex items-center gap-2 ${className ?? ""}`}>
      <Stars rating={rating.average} />
      <span className="font-semibold">{rating.average.toFixed(1)}</span>
      <span className="text-muted">{t("count", { count: rating.count })}</span>
    </p>
  );
}
