import { getFormatter, getTranslations } from "next-intl/server";
import { Pill } from "@/components/ui/pill";
import { parseIsoDate } from "@/utils/dates";
import type { TeamReview } from "../types";
import { Stars } from "./rating-stars";
import { ReviewControls } from "./review-controls";

/**
 * Every review of the place as its team sees it: who wrote it about which stay, whether guests see it (and why not),
 * and the controls to answer or hide it. A place nobody has reviewed says so.
 */
export async function TeamReviewList({
  businessId,
  reviews,
}: {
  businessId: string;
  reviews: readonly TeamReview[];
}) {
  const [t, names, format] = await Promise.all([
    getTranslations("dashboard.reviews"),
    getTranslations("reviews"),
    getFormatter(),
  ]);
  if (reviews.length === 0)
    return <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("empty")}</p>;
  return (
    <ul className="grid gap-4">
      {reviews.map((review) => (
        <li key={review.id}>
          <article className="grid gap-4 rounded-xl bg-surface p-5 ring-1 ring-line lg:grid-cols-2 lg:gap-8">
            <div className="grid content-start gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars rating={review.rating} />
                <span className="font-semibold">
                  <bdi>{review.authorName ?? names("anonymous")}</bdi>
                </span>
                <span className="text-sm text-muted">
                  {format.dateTime(parseIsoDate(review.writtenOn), { year: "numeric", month: "long" })}
                </span>
                {review.status === "HIDDEN" ? <Pill>{t("hidden")}</Pill> : null}
              </div>
              {review.roomName || review.bookingReference ? (
                <p className="text-sm text-muted">
                  {review.roomName ? <bdi>{review.roomName}</bdi> : null}
                  {review.roomName && review.bookingReference ? " · " : null}
                  {review.bookingReference ? <bdi dir="ltr">{review.bookingReference}</bdi> : null}
                </p>
              ) : null}
              <p className="leading-relaxed whitespace-pre-line">
                <bdi>{review.comment}</bdi>
              </p>
              {review.status === "HIDDEN" && review.hiddenReason ? (
                <p className="text-sm text-muted">{t("hiddenBecause", { reason: review.hiddenReason })}</p>
              ) : null}
            </div>
            <ReviewControls
              businessId={businessId}
              reviewId={review.id}
              ownerReply={review.ownerReply}
              hidden={review.status === "HIDDEN"}
            />
          </article>
        </li>
      ))}
    </ul>
  );
}
