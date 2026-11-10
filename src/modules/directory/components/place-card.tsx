import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { PlaceArt } from "@/components/brand/place-art";
import type { Locale } from "@/config/appearance";
import { formatMoney } from "@/utils/format";
import { stagger } from "@/utils/motion";
import type { PlaceCard as PlaceCardData } from "../types";

/** The most cards in the grid's first row (six on the widest screens). */
const FIRST_ROW = 6;

/** A square photo, then three short lines: the name, the town, and the price of the stay or of a night. */
export async function PlaceCard({
  place,
  categoryLabel,
  query = "",
  index = 0,
  action,
}: {
  place: PlaceCardData;
  /** The place's first category, in the reader's language, shown on the photo. */
  categoryLabel?: string;
  /** Carried into the place page, so the dates and guests searched are already picked there. */
  query?: string;
  index?: number;
  /** A control in the photo's far corner, outside the link: the heart on a guest's saved places. */
  action?: ReactNode;
}) {
  const [t, locale] = await Promise.all([getTranslations("place"), getLocale()]);
  const money = (cents: number) => formatMoney(cents, place.currency, locale as Locale);
  return (
    <article className="group rise-in relative" style={stagger(index)}>
      <Link href={`/p/${place.slug}${query}`} className="block rounded-xl">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
          {place.photo ? (
            <Image
              src={place.photo.url}
              alt={place.photo.alt ?? place.name}
              fill
              // The first row is on screen as the page opens (the biggest thing on a phone): it loads at once.
              loading={index < FIRST_ROW ? "eager" : "lazy"}
              sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <PlaceArt seed={place.slug} className="size-full" />
          )}
          {categoryLabel ? (
            <span className="absolute start-2.5 top-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-soft">
              {categoryLabel}
            </span>
          ) : null}
          {place.featured ? (
            <span className="absolute start-2.5 bottom-2.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-ink ring-1 ring-accent-line">
              {t("featured")}
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 grid text-sm leading-snug">
          <h3 className="truncate font-semibold tracking-normal">{place.name}</h3>
          {place.area ? <p className="truncate text-muted">{place.area}</p> : null}
          <p className="mt-0.5">
            {place.stayTotalFromCents !== null ? (
              <>
                <span className="font-semibold underline underline-offset-2">
                  {money(place.stayTotalFromCents)}
                </span>{" "}
                <span className="text-muted">{t("total")}</span>
              </>
            ) : (
              <>
                <span className="font-semibold">{money(place.nightlyFromCents)}</span>{" "}
                <span className="text-muted">{t("perNight")}</span>
              </>
            )}
          </p>
        </div>
      </Link>
      {/* After the link, so it takes the tap in its own corner instead of opening the place. */}
      {action ? <div className="absolute end-1 top-1">{action}</div> : null}
    </article>
  );
}
