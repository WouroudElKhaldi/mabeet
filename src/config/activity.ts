// What a person's Activity page tells, one line per kind of entry on their timeline (`ActivityLog.action`). An
// entry of any other kind stays in the log but is not shown, so a new kind needs a line here and its text in the
// three message files (`account.activity.actions`), with its icon in `activity-list.tsx`.

const ACTIVITY_ACTIONS = [
  "booking.requested",
  "booking.confirmed",
  "booking.declined",
  "booking.cancelled",
  "booking.cancelled_by_guest",
  "booking.expired",
  "review.written",
  "favorite.saved",
  "favorite.removed",
  "member.invitation_accepted",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const isActivityAction = (action: string): action is ActivityAction =>
  (ACTIVITY_ACTIONS as readonly string[]).includes(action);
