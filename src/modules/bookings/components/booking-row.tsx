import type { BookingStatus } from "@prisma/client";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/config/appearance";
import { EXPIRING_BOOKING_STATUSES } from "@/config/enums";
import { panelClass } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { todayUtc } from "@/utils/dates";
import { formatMoney, formatSessionTime, formatStayDates } from "@/utils/format";
import { BookingActions } from "./booking-actions";

/** What a stay and seats share on the row. */
interface RowBasics {
  id: string;
  reference: string;
  guestName: string;
  totalCents: number;
  currency: string;
  status: BookingStatus;
  holdExpiresAt: Date | null;
}

/** What the row shows of a stay, as `listBookings` returns it to the team. */
export interface BookingRowData extends RowBasics {
  guestCount: number;
  checkIn: Date;
  checkOut: Date;
  room: { name: string };
}

/** What the row shows of seats in a session, as `listSessionBookings` returns them to the team. */
export interface SeatRowData extends RowBasics {
  seats: number;
  offering: { title: string };
  session: { startsAt: Date };
}

/** "in 8 minutes", "in 23 hours": how long a waiting booking has before it ends by itself. */
function timeLeft(until: Date, now: Date, locale: Locale): string {
  const minutes = Math.ceil((until.getTime() - now.getTime()) / 60_000);
  const format = new Intl.RelativeTimeFormat(`${locale}-u-nu-latn`, { numeric: "always" });
  return minutes < 90 ? format.format(minutes, "minute") : format.format(Math.round(minutes / 60), "hour");
}

/** The decisions the host can take now, as the booking service allows them. */
function decisionsFor(booking: BookingRowData | SeatRowData, now: Date) {
  if (booking.status === "HELD") return ["confirm", "decline"] as const;
  const ahead = "seats" in booking ? booking.session.startsAt > now : booking.checkIn > todayUtc(now);
  if (booking.status === "CONFIRMED" && ahead) return ["cancel"] as const;
  return [] as const;
}

/**
 * One booking on the host's Bookings page, a stay or seats in a session: the guest, what they booked and when, the
 * total and status, how long a waiting booking has left, and the host's answers when they may decide.
 */
export function BookingRow({
  booking,
  businessId,
  canDecide,
  now,
  timezone = "UTC",
}: {
  booking: BookingRowData | SeatRowData;
  businessId: string;
  canDecide: boolean;
  now: Date;
  /** Where the place is, for a session's time; a stay's nights are days and need none. */
  timezone?: string;
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
          {"seats" in booking ? (
            <>
              <bdi>{booking.offering.title}</bdi> ·{" "}
              <bdi>{formatSessionTime(booking.session.startsAt, locale, timezone)}</bdi> ·{" "}
              {t("guests", { count: booking.seats })}
            </>
          ) : (
            <>
              <bdi>{booking.room.name}</bdi> ·{" "}
              <bdi>{formatStayDates(booking.checkIn, booking.checkOut, locale)}</bdi> ·{" "}
              {t("guests", { count: booking.guestCount })}
            </>
          )}
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
          seats={"seats" in booking}
        />
      ) : null}
    </li>
  );
}
