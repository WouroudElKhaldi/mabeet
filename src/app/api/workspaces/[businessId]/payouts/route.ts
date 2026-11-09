import { workspaceParams } from "@/lib/schemas";
import { getPayouts, requestPayout } from "@/modules/bookings/server";
import { payoutRequestInput } from "@/modules/payments";
import { json, parseBody, tenantRoute } from "@/server/http/route";

/** What Mabeet holds for the business, its payouts and its online payments. Owners only. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => {
  return json(await getPayouts(ctx));
});

/** Asks for a payout to a bank account or a Whish number, up to what is available. Owners only. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await requestPayout(ctx, await parseBody(request, payoutRequestInput)), 201);
});
