import { listTeamReviews } from "@/modules/reviews/server";
import { workspaceParams } from "@/lib/schemas";
import { json, tenantRoute } from "@/server/http/route";

/** Every review of the place, hidden ones included, for its team. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => json(await listTeamReviews(ctx)));
