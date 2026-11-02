"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { DateRangePicker, type DateRangeValue } from "@/components/ui/date-range-picker";
import { inputClass, LabeledControl, panelClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { GuestCounter } from "@/components/ui/guest-counter";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/appearance";
import { MAX_STAY_NIGHTS } from "@/config/booking-limits";
import { useLiveQuery } from "@/hooks/use-live-query";
import { clampGuests } from "@/utils/guest-count";
import { formatMoney } from "@/utils/format";
import { isCompleteStay } from "@/utils/stay-selection";
import { availabilityWindow } from "../availability-window";
import { bookingHref } from "../booking-link";
import { hasUniformRate, stayHitsTakenNights } from "../summary";
import type { PublicPlace, PublicUnit, RoomAvailability, RoomQuote } from "../types";

interface BookingBoxProps {
  place: Pick<PublicPlace, "slug" | "currency" | "bookingMode">;
  units: readonly PublicUnit[];
  /** A stay carried over from a search or a link. Anything that does not fit is dropped when the calendar opens. */
  initial?: { roomId?: string; checkIn?: string; checkOut?: string; guests?: number };
}

const DEFAULT_GUESTS = 2;

/**
 * Where a guest picks the dates and the guests, sees the price of the stay, and goes on to book. The price comes from
 * the server for the dates picked, so it is always the one the booking will charge.
 */
export function BookingBox({ place, units, initial = {} }: BookingBoxProps) {
  const t = useTranslations("booking");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const [roomId, setRoomId] = useState(
    units.some((unit) => unit.id === initial.roomId) ? (initial.roomId ?? "") : (units[0]?.id ?? ""),
  );
  const unit = units.find((candidate) => candidate.id === roomId);
  const [dates, setDates] = useState<DateRangeValue>({
    checkIn: initial.checkIn ?? null,
    checkOut: initial.checkOut ?? null,
  });
  const [guests, setGuests] = useState(initial.guests ?? DEFAULT_GUESTS);

  // What is taken is read once for the year ahead, for the room chosen; the calendar shows those nights as taken.
  const [window] = useState(() => availabilityWindow());
  const availability = useLiveQuery<RoomAvailability>(
    unit ? `/api/public/places/${encodeURIComponent(place.slug)}/rooms/${roomId}/availability` : null,
    window,
  );
  const takenNights = availability.data?.takenNights;

  const complete = isCompleteStay(dates);
  // The room was switched, or somebody booked while the page was open: the stay picked may now cross a taken night.
  const taken = isCompleteStay(dates) && takenNights !== undefined && stayHitsTakenNights(dates, takenNights);
  const quote = useLiveQuery<RoomQuote>(
    complete && unit ? `/api/public/places/${encodeURIComponent(place.slug)}/rooms/${roomId}/quote` : null,
    complete ? { checkIn: dates.checkIn, checkOut: dates.checkOut, guests } : undefined,
  );

  if (!unit) return null;
  const capacity = Math.max(1, unit.capacity);
  const shownGuests = clampGuests(guests, 1, capacity);
  const result = quote.data;
  const bookable = result !== null && result.issue === null && !taken;
  const money = (cents: number) => formatMoney(cents, place.currency, locale);

  return (
    <div className={`${panelClass} flex flex-col gap-5 shadow-lift`}>
      <p className="text-xl font-semibold">
        {money(unit.baseRateCents)} <span className="text-sm font-normal text-muted">{t("perNight")}</span>
      </p>

      {units.length > 1 ? (
        <LabeledControl label={t("room")}>
          <select className={inputClass} value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {units.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </LabeledControl>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("dates")}</span>
        <DateRangePicker
          value={dates}
          onChange={setDates}
          minNights={unit.minNights}
          maxNights={MAX_STAY_NIGHTS}
          maxDate={window.to}
          takenNights={takenNights}
        />
      </div>

      <GuestCounter value={shownGuests} onChange={setGuests} max={capacity} />

      {taken ? <FormError message={t("justTaken")} /> : null}

      <Quote
        complete={complete && !taken}
        loading={quote.loading}
        error={quote.error}
        onRetry={quote.reload}
        result={result}
        money={money}
        maxNights={MAX_STAY_NIGHTS}
        minNights={unit.minNights}
        capacity={capacity}
        retryLabel={t("tryAgain")}
        loadingLabel={common("loading")}
      />

      {bookable && isCompleteStay(dates) ? (
        <ButtonLink
          size="lg"
          href={bookingHref(place.slug, { roomId, guests: shownGuests, dates })}
          className="w-full"
        >
          {place.bookingMode === "AUTOMATIC" ? t("bookNow") : t("request")}
        </ButtonLink>
      ) : (
        <Button size="lg" className="w-full" aria-disabled>
          {complete ? t("checkDates") : t("pickDatesFirst")}
        </Button>
      )}
      <p className="text-center text-sm text-muted">{t(`modeLine.${place.bookingMode}`)}</p>
    </div>
  );
}

interface QuoteProps {
  complete: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  result: RoomQuote | null;
  money: (cents: number) => string;
  maxNights: number;
  minNights: number;
  capacity: number;
  retryLabel: string;
  loadingLabel: string;
}

// What sits between the guest's choices and the Book button: nothing until both dates are picked, then the price,
// or the reason the stay cannot be booked, or a calm error with a way to try again.
function Quote({
  complete,
  loading,
  error,
  onRetry,
  result,
  money,
  maxNights,
  minNights,
  capacity,
  retryLabel,
  loadingLabel,
}: QuoteProps) {
  const t = useTranslations("booking");
  const dates = useTranslations("dates");
  if (!complete) return null;
  if (loading) {
    return (
      <div role="status" className="flex flex-col gap-2">
        <span className="sr-only">{loadingLabel}</span>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-7 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-start gap-2">
        <FormError message={error} />
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    );
  }
  if (!result) return null;
  if (result.issue) {
    const messages = {
      PAST: t("issues.PAST"),
      TOO_FAR: t("issues.TOO_FAR"),
      TOO_LONG: t("issues.TOO_LONG", { max: maxNights }),
      MIN_NIGHTS: t("issues.MIN_NIGHTS", { count: minNights }),
      CAPACITY: t("issues.CAPACITY", { count: capacity }),
    };
    return <FormError message={messages[result.issue]} />;
  }
  const uniform = hasUniformRate(result.nights);
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <p className="flex justify-between gap-4 text-sm text-muted">
        <span>
          {uniform && result.nights[0]
            ? t("nightsTimesRate", { count: result.nightCount, rate: money(result.nights[0].rateCents) })
            : dates("nights", { count: result.nightCount })}
        </span>
      </p>
      <p className="flex justify-between gap-4 text-lg font-semibold">
        <span>{t("total")}</span>
        <span className="tabular-nums">{money(result.totalCents)}</span>
      </p>
    </div>
  );
}
