import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/site/section";
import type { Locale } from "@/config/appearance";
import { formatMoney } from "@/utils/format";
import { lowestRateCents } from "../summary";
import type { PublicPlace } from "../types";
import { AmenityList } from "./amenity-list";
import { BookingBox } from "./booking-box";
import { PhotoGallery } from "./photo-gallery";
import { PlaceHeader } from "./place-header";
import { PlaceSummary } from "./place-summary";
import { ThingsToKnow } from "./things-to-know";
import { UnitList } from "./unit-list";

/**
 * A place's page: its photos and description, what it offers and the things to know, and the box where the guest
 * picks dates and books. On a phone the box comes after the text and a bar fixed at the bottom leads to it.
 */
export async function PlaceView({
  place,
  initial,
}: {
  place: PublicPlace;
  /** A stay carried over from a search or a link (the page's address). */
  initial?: { roomId?: string; checkIn?: string; checkOut?: string; guests?: number };
}) {
  const [t, locale] = await Promise.all([getTranslations("placePage"), getLocale()]);
  const [booking, known, card] = await Promise.all([
    getTranslations("booking"),
    getTranslations("thingsToKnow"),
    getTranslations("place"),
  ]);
  const whole = place.bookingUnit === "WHOLE_PLACE";
  const fromRate = lowestRateCents(place.units);
  const allUnits = whole ? [...place.units, ...place.rooms] : place.units;

  return (
    <div className="mx-auto max-w-280 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pb-16">
      <PlaceHeader place={place} />
      <PhotoGallery name={place.name} photos={place.photos} />
      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-20">
        <div className="flex min-w-0 flex-col gap-10">
          <div className="flex flex-col gap-4">
            <PlaceSummary place={place} />
            {place.description ? (
              <p className="leading-relaxed whitespace-pre-line">{place.description}</p>
            ) : null}
          </div>
          {place.rooms.length > 0 ? (
            <Section
              id="rooms"
              title={whole ? t("whereYoullSleep") : t("rooms")}
              intro={whole ? t("wholePlaceIntro", { guests: place.units[0]?.capacity ?? 0 }) : undefined}
            >
              <UnitList units={place.rooms} currency={place.currency} showPrice={!whole} />
            </Section>
          ) : null}
          <Section id="amenities" title={t("amenities")}>
            <AmenityList units={allUnits} />
          </Section>
          <Section id="things-to-know" title={known("title")}>
            <ThingsToKnow place={place} />
          </Section>
        </div>
        <aside id="booking" className="scroll-mt-28 lg:sticky lg:top-28 lg:self-start">
          {place.units.length > 0 ? (
            <BookingBox place={place} units={place.units} initial={initial} />
          ) : (
            <p className="rounded-xl bg-surface-2 p-5 text-muted">{t("noRooms")}</p>
          )}
        </aside>
      </div>
      {place.units.length > 0 && fromRate !== null ? (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-line bg-surface px-4 py-3 lg:hidden">
          <p className="font-semibold">
            <span className="text-sm font-normal text-muted">{card("from")} </span>
            {formatMoney(fromRate, place.currency, locale as Locale)}{" "}
            <span className="text-sm font-normal text-muted">{booking("perNight")}</span>
          </p>
          <ButtonLink href="#booking">{booking("checkDates")}</ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
