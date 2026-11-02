import { bookingActionParams, decisionInput } from "@/modules/bookings";
import { cancelBooking, confirmBooking, declineBooking } from "@/modules/bookings/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

const DECISIONS = { confirm: confirmBooking, decline: declineBooking, cancel: cancelBooking } as const;

/** The host confirms, declines or cancels a stay. A paid stay that ends is refunded in full. */
export const POST = tenantRoute(
  bookingActionParams,
  async ({ request, ctx, params: { bookingId, action } }) => {
    const { reason } = await parseBody(request, decisionInput);
    return json(await DECISIONS[action](ctx, { bookingId, reason }));
  },
);
