import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PlaceArt } from "@/components/brand/place-art";
import type { Locale } from "@/config/appearance";
import { formatMoney, formatSessionTime } from "@/utils/format";
import { stagger } from "@/utils/motion";
import { durationText } from "../offering-text";
import type { OfferingCard as OfferingCardData } from "../types";

/** Same shape as a place card: a square photo, the title, the town and how long it lasts, the price, the next date. */
export async function OfferingCard({
  offering,
  categoryLabel,
  index = 0,
}: {
  offering: OfferingCardData;
  /** The offering's category, in the reader's language, shown on the photo. */
  categoryLabel?: string;
  index?: number;
}) {
  const [t, locale] = await Promise.all([getTranslations("offering"), getLocale()]);
  return (
    <article className="group rise-in" style={stagger(index)}>
      <Link href={`/o/${offering.slug}`} className="block rounded-xl">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
          {offering.photo ? (
            <Image
              src={offering.photo.url}
              alt={offering.photo.alt ?? offering.title}
              fill
              sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <PlaceArt seed={offering.slug} className="size-full" />
          )}
          {categoryLabel ? (
            <span className="absolute start-2.5 top-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-soft">
              {categoryLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 grid text-sm leading-snug">
          <h3 className="line-clamp-2 font-semibold tracking-normal">{offering.title}</h3>
          <p className="truncate text-muted">
            {[offering.area, durationText(t, offering.durationMinutes)].filter(Boolean).join(" · ")}
          </p>
          {offering.nextStartsAt ? (
            <p className="truncate text-muted">
              {t("next", {
                when: formatSessionTime(offering.nextStartsAt, locale as Locale, offering.timezone),
              })}
            </p>
          ) : null}
          <p className="mt-0.5">
            <span className="text-muted">{t("from")}</span>{" "}
            <span className="font-semibold">
              {formatMoney(offering.priceCents, offering.currency, locale as Locale)}
            </span>{" "}
            <span className="text-muted">
              {offering.priceUnit === "PER_PERSON" ? t("perPerson") : t("perGroup")}
            </span>
          </p>
        </div>
      </Link>
    </article>
  );
}
