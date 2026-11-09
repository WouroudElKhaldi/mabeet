import { countFeed, countFeedSince, type FeedScope, listFeed } from "@/modules/audit/server";
import { markNotificationsSeen, notificationsSeenAt } from "@/modules/accounts/server";
import {
  can,
  type PlatformActor,
  requirePlatformAdmin,
  type TenantContext,
} from "@/server/auth/tenant-context";

// The bell: what happened that the person should know about, read from the audit log. Emails and push send the same
// news outward; this is the list inside the app. Settings saves and photo uploads are not news. A new kind of entry
// needs its action here, an icon in notification-list.tsx and its text in the three message files.

/** For people who handle bookings: requests, answers, cancellations, payments and calendar clashes. */
const BOOKING_NEWS = [
  "calendar.conflict",
  "calendar.conflict_resolved",
  "booking.requested",
  "booking.confirmed",
  "booking.declined",
  "booking.cancelled",
  "booking.cancelled_by_guest",
  "payment.online_confirmed",
  "payment.online_late",
] as const;

/** For owners: their money and their team. */
const OWNER_NEWS = [
  "payout.requested",
  "payout.sent",
  "payout.refused",
  "member.invited",
  "member.invitation_accepted",
  "member.invitation_cancelled",
  "member.removed",
  "member.role_changed",
] as const;

/** For platform admins: what needs them, across every business. */
const PLATFORM_NEWS = ["payout.requested", "payment.online_late", "booking.requested"] as const;

const PAGE_SIZE = 20;
/** The bell's card: the latest few. */
const LATEST = 5;

function businessNews(ctx: TenantContext): string[] {
  return [...(can(ctx, "bookings.read") ? BOOKING_NEWS : []), ...(ctx.isOwner ? OWNER_NEWS : [])];
}

/** One page of the feed, newest first; `page` starts at 1 and is held to the pages there are. */
async function feed(
  scope: FeedScope,
  actions: readonly string[],
  userId: string,
  page: number,
  size: number,
) {
  if (actions.length === 0) return { items: [], seenAt: null, page: 1, pages: 1 };
  const total = await countFeed(scope, actions);
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page)), pages);
  const [items, seenAt] = await Promise.all([
    listFeed(scope, actions, { take: size, skip: (current - 1) * size }),
    notificationsSeenAt(userId),
  ]);
  return { items, seenAt, page: current, pages };
}

export function getBusinessNotifications(ctx: TenantContext, page = 1) {
  return feed({ businessId: ctx.businessId }, businessNews(ctx), ctx.userId, page, PAGE_SIZE);
}

export function getLatestBusinessNotifications(ctx: TenantContext) {
  return feed({ businessId: ctx.businessId }, businessNews(ctx), ctx.userId, 1, LATEST);
}

export async function countBusinessUnread(ctx: TenantContext): Promise<number> {
  const actions = businessNews(ctx);
  if (actions.length === 0) return 0;
  return countFeedSince(
    { businessId: ctx.businessId },
    actions,
    await notificationsSeenAt(ctx.userId),
    ctx.userId,
  );
}

export function getPlatformNotifications(actor: PlatformActor, page = 1) {
  requirePlatformAdmin(actor);
  return feed({ platform: true }, PLATFORM_NEWS, actor.userId, page, PAGE_SIZE);
}

export function getLatestPlatformNotifications(actor: PlatformActor) {
  requirePlatformAdmin(actor);
  return feed({ platform: true }, PLATFORM_NEWS, actor.userId, 1, LATEST);
}

export async function countPlatformUnread(actor: PlatformActor): Promise<number> {
  requirePlatformAdmin(actor);
  return countFeedSince(
    { platform: true },
    PLATFORM_NEWS,
    await notificationsSeenAt(actor.userId),
    actor.userId,
  );
}

/** Opening the bell or the notifications page marks everything up to now as read, in every business. */
export function markSeen(userId: string, now = new Date()) {
  return markNotificationsSeen(userId, now);
}
