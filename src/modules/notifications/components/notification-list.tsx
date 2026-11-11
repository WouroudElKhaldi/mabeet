"use client";

import clsx from "clsx";
import {
  BellOff,
  CalendarCheck,
  CalendarX2,
  CreditCard,
  Inbox,
  Landmark,
  type LucideIcon,
  UsersRound,
} from "lucide-react";
import type { Messages } from "next-intl";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

type ActionText = keyof Messages["notifications"]["actions"];

export interface NotificationItem {
  id: string;
  action: string;
  /** Who did it; empty for the system's own events. */
  actorId: string | null;
  createdAt: Date | string;
  actor: { name: string } | null;
  business: { id: string; name: string } | null;
  /** The booking it is about, as the booking engine wrote it on the event. */
  booking: { guest: string; reference: string } | null;
}

/** Each kind of entry the bell shows: its icon and its text. An action not listed here is never shown. */
const ENTRIES: Record<string, { icon: LucideIcon; text: ActionText }> = {
  "booking.requested": { icon: Inbox, text: "booking_requested" },
  "booking.confirmed": { icon: CalendarCheck, text: "booking_confirmed" },
  "booking.declined": { icon: CalendarX2, text: "booking_declined" },
  "booking.cancelled": { icon: CalendarX2, text: "booking_cancelled" },
  "booking.cancelled_by_guest": { icon: CalendarX2, text: "booking_cancelled_by_guest" },
  "calendar.conflict": { icon: CalendarX2, text: "calendar_conflict" },
  "calendar.conflict_resolved": { icon: CalendarCheck, text: "calendar_conflict_resolved" },
  "payment.online_confirmed": { icon: CreditCard, text: "payment_online_confirmed" },
  "payment.online_late": { icon: CreditCard, text: "payment_online_late" },
  "payout.requested": { icon: Landmark, text: "payout_requested" },
  "payout.sent": { icon: Landmark, text: "payout_sent" },
  "payout.refused": { icon: Landmark, text: "payout_refused" },
  "member.invited": { icon: UsersRound, text: "member_invited" },
  "member.invitation_accepted": { icon: UsersRound, text: "member_invitation_accepted" },
  "member.invitation_cancelled": { icon: UsersRound, text: "member_invitation_cancelled" },
  "member.removed": { icon: UsersRound, text: "member_removed" },
  "member.role_changed": { icon: UsersRound, text: "member_role_changed" },
};

/** Where a notification leads: the bookings, calendar, payouts or team page of its business, or the admin's money. */
function hrefFor(item: NotificationItem, admin: boolean): string | null {
  const businessId = item.business?.id;
  if (!businessId) return null;
  if (item.action.startsWith("payout.")) return admin ? "/admin/money" : `/dashboard/${businessId}/payouts`;
  if (item.action.startsWith("member.")) return `/dashboard/${businessId}/team`;
  if (item.action.startsWith("calendar.")) return `/dashboard/${businessId}/calendar`;
  return `/dashboard/${businessId}/bookings`;
}

/**
 * Notifications, newest first, the new ones marked, each linking to where to act. The full page and the bell's card
 * both use it; `compact` is the card's tighter version.
 */
export function NotificationList({
  items,
  seenAt,
  viewerId,
  admin = false,
  compact = false,
  onNavigate,
}: {
  items: NotificationItem[];
  seenAt: Date | string | null;
  viewerId: string;
  admin?: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const seen = seenAt ? new Date(seenAt) : null;
  const ago = (date: Date) => {
    const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, "hour");
    return relative.format(Math.round(hours / 24), "day");
  };
  const shown = items.flatMap((item) => {
    const entry = ENTRIES[item.action];
    return entry ? [{ item, entry }] : [];
  });

  if (shown.length === 0) {
    return (
      <div
        className={clsx(
          "grid place-items-center gap-3 text-center",
          compact ? "px-4 py-8" : "rounded-xl bg-surface px-6 py-16 ring-1 ring-line",
        )}
      >
        <BellOff className={compact ? "size-6 text-faint" : "size-8 text-faint"} aria-hidden />
        <p className="text-sm text-muted">{t("empty")}</p>
      </div>
    );
  }

  return (
    <ul
      className={clsx(
        "divide-y divide-line overflow-hidden",
        !compact && "rounded-xl bg-surface ring-1 ring-line",
      )}
    >
      {shown.map(({ item, entry }) => {
        const Icon = entry.icon;
        const at = new Date(item.createdAt);
        const unread = (!seen || at > seen) && item.actorId !== viewerId;
        const href = hrefFor(item, admin);
        const text = t(`actions.${entry.text}`, {
          actor: item.actor?.name ?? t("someone"),
          guest: item.booking?.guest ?? t("aGuest"),
          reference: item.booking?.reference ?? "",
        });
        const row = clsx("flex items-center gap-3", compact ? "px-3 py-2.5" : "px-4 py-3");
        const body = (
          <>
            <span
              className={clsx(
                "grid shrink-0 place-items-center rounded-full",
                compact ? "size-8" : "size-9",
                unread ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className={clsx("block text-sm", compact && "line-clamp-2", unread && "font-semibold")}>
                {text}
              </span>
              <span className="block text-xs text-muted">
                {admin && item.business ? (
                  <>
                    <bdi>{item.business.name}</bdi>
                    {" · "}
                  </>
                ) : null}
                {/* Relative to the moment it renders, so the server's and the browser's text can differ by a minute. */}
                <time dateTime={at.toISOString()} suppressHydrationWarning>
                  {ago(at)}
                </time>
              </span>
            </span>
            {unread && <span className="size-2 shrink-0 rounded-full bg-glow" aria-label={t("unread")} />}
          </>
        );
        return (
          <li key={item.id}>
            {href ? (
              <Link
                href={href}
                onClick={onNavigate}
                className={clsx(row, "transition-colors hover:bg-surface-2")}
              >
                {body}
              </Link>
            ) : (
              <div className={row}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
