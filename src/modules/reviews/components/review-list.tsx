import { getFormatter, getTranslations } from "next-intl/server";
import { ShowAllDialog } from "@/components/ui/show-all-dialog";
import { parseIsoDate } from "@/utils/dates";
import type { PlaceReview } from "../types";
import { Stars } from "./rating-stars";

/** How many reviews a page shows before "Show all". */
const SHOWN = 4;

async function ReviewCard({ review }: { review: PlaceReview }) {
  const [t, format] = await Promise.all([getTranslations("reviews"), getFormatter()]);
  return (
    <article className="grid gap-2 rounded-xl bg-surface-2 p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars rating={review.rating} />
        <span className="font-semibold">{review.authorName ?? t("anonymous")}</span>
        <span className="text-sm text-muted">
          {format.dateTime(parseIsoDate(review.writtenOn), { year: "numeric", month: "long" })}
        </span>
      </div>
      <p className="leading-relaxed whitespace-pre-line">{review.comment}</p>
      {review.ownerReply ? (
        <div className="mt-2 border-s-2 border-line ps-4">
          <p className="text-sm font-semibold">{t("hostReply")}</p>
          <p className="leading-relaxed whitespace-pre-line">{review.ownerReply}</p>
        </div>
      ) : null}
    </article>
  );
}

/**
 * What guests say: the newest few, then the rest in a dialog. A place nobody has reviewed says so, so the section
 * never looks broken on a new place.
 */
export async function ReviewList({
  reviews,
  placeName,
}: {
  reviews: readonly PlaceReview[];
  placeName: string;
}) {
  const t = await getTranslations("placePage");
  if (reviews.length === 0) return <p className="text-muted">{t("noReviews")}</p>;
  return (
    <div className="grid gap-4">
      <ul className="grid gap-4 sm:grid-cols-2">
        {reviews.slice(0, SHOWN).map((review) => (
          <li key={review.id}>
            <ReviewCard review={review} />
          </li>
        ))}
      </ul>
      {reviews.length > SHOWN ? (
        <div>
          <ShowAllDialog label={t("showAllReviews", { count: reviews.length })} title={placeName}>
            <ul className="grid gap-4">
              {reviews.map((review) => (
                <li key={review.id}>
                  <ReviewCard review={review} />
                </li>
              ))}
            </ul>
          </ShowAllDialog>
        </div>
      ) : null}
    </div>
  );
}
