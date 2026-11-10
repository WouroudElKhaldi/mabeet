import { reviewParams, reviewVisibility } from "@/modules/reviews";
import { setReviewVisibility } from "@/modules/reviews/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** Hides a review from guests with a reason, or shows it again. */
export const PUT = tenantRoute(reviewParams, async ({ ctx, params: { reviewId }, request }) => {
  await setReviewVisibility(ctx, reviewId, await parseBody(request, reviewVisibility));
  return json({ ok: true });
});
