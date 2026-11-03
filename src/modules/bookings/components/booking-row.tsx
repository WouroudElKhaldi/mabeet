import type { BookingStatus } from "@prisma/client";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/config/appearance";
import { EXPIRING_BOOKING_STATUSES } from "@/config/enums";
import { panelClass } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { todayUtc } from "@/utils/dates";
import { formatMoney, formatStayDates } from "@/utils/format";
import { BookingActions } from "./booking-actions";

/** What the row shows of a booking, as `listBookings` returns it to the team. */
export interface BookingRowData {
  id: string;
  reference: string;
  guestName: string;
  guestCount: number;
  checkIn: Date;
  checkOut: Date;
  totalCents: number;
  currency: string;
  status: BookingStatus;
  holdExpiresAt: Date | null;
  room: { name: string };
}

/** "in 8 minutes", "in 23 hours": how long a waiting booking has before it ends by itself. */
function timeLeft(until: Date, now: Date, locale: Locale): string {
  const minutes = Math.ceil((until.getTime() - now.getTime()) / 60_000);
  const format = new Intl.RelativeTimeFormat(`${locale}-u-nu-latn`, { numeric: "always" });
  return minutes < 90 ? format.format(minutes, "minute") : format.format(Math.round(minutes / 60), "hour");
}

/** The decisions the host can take now, as the booking service allows them. */
function decisionsFor(booking: BookingRowData, now: Date) {
  if (booking.status === "HELD") return ["confirm", "decline"] as const;
  if (booking.status === "CONFIRMED" && booking.checkIn > todayUtc(now)) return ["cancel"] as const;
  return [] as const;
}

/**
 * One stay on the host's Bookings page: the guest, room, dates, total and status, how long a waiting booking has
 * left, and the host's answers when they may decide.
 */
export function BookingRow({
  booking,
  businessId,
  canDecide,
  now,
}: {
  booking: BookingRowData;
  businessId: string;
  canDecide: boolean;
  now: Date;
}) {
  const t = useTranslations("dashboard.bookings");
  const locale = useLocale();
  const expiring = (EXPIRING_BOOKING_STATUSES as readonly BookingStatus[]).includes(booking.status);
  const deadline = expiring ? booking.holdExpiresAt : null;

  return (
    <li className={`${panelClass} flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          {/* Names are typed by people, in any script: <bdi> keeps an English name from swapping places with the
              Arabic around it. */}
          <bdi className="truncate text-lg font-semibold">{booking.guestName}</bdi>
          <Pill tone={booking.status === "HELD" ? "accent" : "quiet"}>{t(`status.${booking.status}`)}</Pill>
        </p>
        <p className="mt-1 text-sm text-muted">
          <bdi>{booking.room.name}</bdi> ·{" "}
          <bdi>{formatStayDates(booking.checkIn, booking.checkOut, locale)}</bdi> ·{" "}
          {t("guests", { count: booking.guestCount })}
        </p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-semibold tabular-nums">
            {formatMoney(booking.totalCents, booking.currency, locale)}
          </span>
          {deadline ? (
            <span className="text-sm font-semibold text-accent">
              {deadline > now
                ? t(booking.status === "HELD" ? "answerWithin" : "payWithin", {
                    time: timeLeft(deadline, now, locale),
                  })
                : t("timeUp")}
            </span>
          ) : null}
          <span className="text-xs text-faint">{booking.reference}</span>
        </p>
      </div>
      {canDecide ? (
        <BookingActions
          businessId={businessId}
          bookingId={booking.id}
          decisions={decisionsFor(booking, now)}
        />
      ) : null}
    </li>
  );
}
