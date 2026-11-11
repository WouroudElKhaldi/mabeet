import { bookingActionParams, decisionInput } from "@/modules/bookings";
import {
  cancelSessionBooking,
  confirmSessionBooking,
  declineSessionBooking,
} from "@/modules/bookings/server";
import { json, parseBody, tenantRoute } from "@/server/http/route";

const DECISIONS = {
  confirm: confirmSessionBooking,
  decline: declineSessionBooking,
  cancel: cancelSessionBooking,
} as const;

/** The host confirms, declines or cancels seats in a session. Paid seats that end are refunded in full. */
export const POST = tenantRoute(
  bookingActionParams,
  async ({ request, ctx, params: { bookingId, action } }) => {
    const { reason } = await parseBody(request, decisionInput);
    return json(await DECISIONS[action](ctx, { bookingId, reason }));
  },
);
