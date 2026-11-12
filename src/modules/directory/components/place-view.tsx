import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/site/section";
import type { Locale } from "@/config/appearance";
import { NearbyPartners } from "@/modules/partners";
import { formatMoney } from "@/utils/format";
import { lowestRateCents } from "../summary";
import type { NearbyOffering, PublicPlace } from "../types";
import { AmenityList } from "./amenity-list";
import { BookingBox } from "./booking-box";
import { ReviewList } from "@/modules/reviews";
import { countPhotos, groupPhotos } from "../photo-groups";
import { MeetHost } from "./meet-host";
import { NearbyOfferings } from "./nearby-offerings";
import { PlaceMap } from "./place-map";
import { PhotoGallery } from "./photo-gallery";
import { PlaceHeader } from "./place-header";
import { PlaceSummary } from "./place-summary";
import { ThingsToKnow } from "./things-to-know";
import { UnitList } from "./unit-list";

/**
 * A place's page: its photos and description, what it offers and the things to know, and the box where the guest
 * picks dates and books. On a phone the box comes after the text and a bar held at the bottom leads to it. The bar is
 * sticky, not fixed: it rides along the place's page and stops at its end, so it never covers the site's footer.
 */
export async function PlaceView({
  place,
  initial,
  saved,
  signedIn,
  thingsToDo = [],
}: {
  place: PublicPlace;
  /** A stay carried over from a search or a link (the page's address). */
  initial?: { roomId?: string; checkIn?: string; checkOut?: string; guests?: number };
  /** Whether this guest already keeps the place on their list, for the heart. */
  saved: boolean;
  signedIn: boolean;
  /** Experiences and services during the stay in the address, once the guest has picked dates. */
  thingsToDo?: NearbyOffering[];
}) {
  const [t, locale] = await Promise.all([getTranslations("placePage"), getLocale()]);
  const [booking, known, card, host, nearby] = await Promise.all([
    getTranslations("booking"),
    getTranslations("thingsToKnow"),
    getTranslations("place"),
    getTranslations("meetHost"),
    getTranslations("partners.nearby"),
  ]);
  const whole = place.bookingUnit === "WHOLE_PLACE";
  const fromRate = lowestRateCents(place.units);
  const allUnits = whole ? [...place.units, ...place.rooms] : place.units;
  const photoGroups = groupPhotos(place.photos, allUnits);

  return (
    <div className="mx-auto max-w-280 px-4 pt-6 sm:px-6 lg:px-10 lg:pb-16">
      <PlaceHeader place={place} saved={saved} signedIn={signedIn} />
      <PhotoGallery place={place} photoCount={countPhotos(photoGroups)} />
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
          <Section id="reviews" title={t("reviews")}>
            <ReviewList reviews={place.reviews} placeName={place.name} />
          </Section>
          {place.latitude !== null && place.longitude !== null ? (
            <Section id="where" title={t("whereYoullBe")}>
              <PlaceMap place={place} />
            </Section>
          ) : null}
          {place.nearby.length > 0 || thingsToDo.length > 0 ? (
            <Section id="nearby" title={nearby("title")} intro={nearby("intro")}>
              <div className="grid gap-8">
                {thingsToDo.length > 0 ? <NearbyOfferings offerings={thingsToDo} /> : null}
                {place.nearby.length > 0 ? <NearbyPartners partners={place.nearby} /> : null}
              </div>
            </Section>
          ) : null}
          <Section id="host" title={host("title")}>
            <MeetHost place={place} />
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
        <div className="sticky bottom-0 z-20 -mx-4 mt-12 flex items-center justify-between gap-4 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 lg:hidden">
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
