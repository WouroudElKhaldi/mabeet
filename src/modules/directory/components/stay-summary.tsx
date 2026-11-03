import { getLocale, getTranslations } from "next-intl/server";
import { BoardingPass } from "@/components/brand/boarding-pass";
import type { Locale } from "@/config/appearance";
import { formatDate, formatMoney } from "@/utils/format";
import { hasUniformRate } from "../summary";
import type { PublicPlace, RoomQuote } from "../types";

/** The stay as a boarding pass: where, which room, the dates, and what it costs, in full. */
export async function StaySummary({
  place,
  roomName,
  checkIn,
  checkOut,
  quote,
}: {
  place: Pick<PublicPlace, "name" | "bookingMode">;
  roomName: string;
  checkIn: string;
  checkOut: string;
  quote: RoomQuote;
}) {
  const [t, page, booking, locale] = await Promise.all([
    getTranslations("placePage"),
    getTranslations("bookPage"),
    getTranslations("booking"),
    getLocale(),
  ]);
  const money = (cents: number) => formatMoney(cents, quote.currency, locale as Locale);
  const first = quote.nights[0];
  const line =
    hasUniformRate(quote.nights) && first
      ? booking("nightsTimesRate", { count: quote.nightCount, rate: money(first.rateCents) })
      : null;

  return (
    <BoardingPass
      kicker={booking(`modeLine.${place.bookingMode}`)}
      title={place.name}
      subtitle={roomName}
      fields={[
        { label: t("checkIn"), value: formatDate(checkIn, locale as Locale) },
        { label: t("checkOut"), value: formatDate(checkOut, locale as Locale) },
        { label: page("nights"), value: quote.nightCount },
      ]}
      stub={
        <div className="flex flex-col gap-1">
          {line ? <p className="text-sm text-muted">{line}</p> : null}
          <p className="flex justify-between gap-4 text-lg font-semibold">
            <span>{page("total")}</span>
            <span className="tabular-nums">{money(quote.totalCents)}</span>
          </p>
        </div>
      }
    />
  );
}
