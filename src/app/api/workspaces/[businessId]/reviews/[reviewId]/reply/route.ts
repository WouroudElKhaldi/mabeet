import { reviewParams, reviewReply } from "@/modules/reviews";
import { replyToReview } from "@/modules/reviews/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** The host's public answer under a review; an empty one takes it away. */
export const PUT = tenantRoute(reviewParams, async ({ ctx, params: { reviewId }, request }) => {
  await replyToReview(ctx, reviewId, await parseBody(request, reviewReply));
  return json({ ok: true });
});
