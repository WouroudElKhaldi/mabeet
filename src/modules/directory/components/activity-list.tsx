import {
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Heart,
  HeartOff,
  type LucideIcon,
  Send,
  Star,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import type { Messages } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ActivityAction } from "@/config/activity";
import type { ActivityItem } from "../types";

type ActivityMessage = keyof Messages["account"]["activity"]["actions"];

/** Each kind of line: its icon and its text (next-intl reads dots as nesting, so the keys use underscores). */
const LINES: Record<ActivityAction, { icon: LucideIcon; message: ActivityMessage }> = {
  "booking.requested": { icon: Send, message: "booking_requested" },
  "booking.confirmed": { icon: CalendarCheck, message: "booking_confirmed" },
  "booking.declined": { icon: CalendarX, message: "booking_declined" },
  "booking.cancelled": { icon: CalendarX, message: "booking_cancelled" },
  "booking.cancelled_by_guest": { icon: CalendarX, message: "booking_cancelled_by_guest" },
  "booking.expired": { icon: CalendarClock, message: "booking_expired" },
  "review.written": { icon: Star, message: "review_written" },
  "favorite.saved": { icon: Heart, message: "favorite_saved" },
  "favorite.removed": { icon: HeartOff, message: "favorite_removed" },
  "member.invitation_accepted": { icon: UserPlus, message: "member_invitation_accepted" },
};

/**
 * A guest's timeline, newest first: one line per thing they did or that happened to them, with the place and,
 * for a stay, its reference. A line with somewhere to go is a link to it.
 */
export async function ActivityList({ items }: { items: readonly ActivityItem[] }) {
  const [t, format] = await Promise.all([getTranslations("account.activity"), getFormatter()]);
  return (
    <ul className="divide-y divide-line rounded-xl bg-surface ring-1 ring-line">
      {items.map((item) => {
        const { icon: Icon, message } = LINES[item.action];
        const body = (
          <>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-accent">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="font-semibold">
                {t(`actions.${message}`, { place: item.placeName ?? t("aPlace") })}
              </span>
              <span className="text-sm text-muted">
                {format.dateTime(new Date(item.at), { dateStyle: "medium", timeStyle: "short" })}
                {item.reference ? (
                  <>
                    {" · "}
                    <bdi dir="ltr">{item.reference}</bdi>
                  </>
                ) : null}
              </span>
            </span>
          </>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className="flex items-center gap-4 p-4 transition first:rounded-t-xl last:rounded-b-xl hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ink"
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-4 p-4">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
