import { getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/shell/page-header";
import { RatingLine, TeamReviewList } from "@/modules/reviews";
import { getPlaceRating, listTeamReviews } from "@/modules/reviews/server";
import { requirePageAccess } from "@/server/http/session";

type PageProps = { params: Promise<{ businessId: string }> };

/** What guests wrote after their stays: the place's rating, then each review to answer or hide. */
export default async function ReviewsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.reviews.anyOf);
  const [t, reviews, rating] = await Promise.all([
    getTranslations("dashboard.reviews"),
    listTeamReviews(ctx),
    getPlaceRating(businessId),
  ]);
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <RatingLine rating={rating} className="text-lg" />
        <TeamReviewList businessId={businessId} reviews={reviews} />
      </div>
    </>
  );
}
