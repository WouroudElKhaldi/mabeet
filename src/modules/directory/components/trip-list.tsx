import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Pill } from "@/components/ui/pill";
import type { Locale } from "@/config/appearance";
import { ReviewForm } from "@/modules/reviews";
import { parseIsoDate } from "@/utils/dates";
import { formatMoney, formatStayDates } from "@/utils/format";
import type { GuestTrip } from "../types";

/**
 * The stays that are alive or over, each a link to its booking page. A trip that needs the guest (payment) stands
 * out, and a stay that is over and not yet reviewed offers the form, under its card rather than inside the link.
 */
export async function TripList({ trips }: { trips: readonly GuestTrip[] }) {
  const [t, confirmation, locale] = await Promise.all([
    getTranslations("account"),
    getTranslations("confirmation"),
    getLocale(),
  ]);
  return (
    <ul className="grid gap-4">
      {trips.map((trip) => (
        <li key={trip.publicToken}>
          <Link
            href={`/b/${encodeURIComponent(trip.publicToken)}`}
            className="flex flex-col gap-3 rounded-xl bg-surface p-5 ring-1 ring-line transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ink"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{trip.place.name}</p>
                <p className="truncate text-sm text-muted">{trip.roomName}</p>
              </div>
              {/* The label keeps to one line: a long place name gives way to it, not the other way round. */}
              <span className="shrink-0 whitespace-nowrap">
                <Pill
                  tone={
                    trip.status === "AWAITING_PAYMENT" || trip.status === "CONFIRMED" ? "accent" : "quiet"
                  }
                >
                  {t(`status.${trip.status}`)}
                </Pill>
              </span>
            </div>
            <p className="text-sm">
              {formatStayDates(parseIsoDate(trip.checkIn), parseIsoDate(trip.checkOut), locale as Locale)}
              {" · "}
              {confirmation("guests", { count: trip.guestCount })}
              {" · "}
              <span className="font-semibold tabular-nums">
                {formatMoney(trip.totalCents, trip.currency, locale as Locale)}
              </span>
            </p>
          </Link>
          {trip.canReview ? (
            <div className="mt-2 ps-1">
              <ReviewForm token={trip.publicToken} placeName={trip.place.name} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
