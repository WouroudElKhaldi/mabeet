import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { PlaceArt } from "@/components/brand/place-art";
import type { Locale } from "@/config/appearance";
import { formatMoney } from "@/utils/format";
import type { PublicUnit } from "../types";

/** The rooms (or, at a place booked whole, the rooms inside it), each with its photo, size and price. */
export async function UnitList({
  units,
  currency,
  showPrice,
}: {
  units: readonly PublicUnit[];
  currency: string;
  /** Rooms of a place booked whole have no price of their own. */
  showPrice: boolean;
}) {
  const [t, locale] = await Promise.all([getTranslations("placePage"), getLocale()]);
  return (
    <ul className="grid gap-4">
      {units.map((unit) => {
        const photo = unit.photos[0];
        const facts = [t("sleeps", { count: unit.capacity }), t("beds", { count: unit.beds })];
        if (unit.minNights > 1) facts.push(t("minNights", { count: unit.minNights }));
        return (
          <li key={unit.id} className="flex gap-4 rounded-xl p-3 ring-1 ring-line">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:size-28">
              {photo ? (
                <Image
                  src={photo.url}
                  alt={photo.alt ?? unit.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              ) : (
                <PlaceArt seed={unit.id} className="size-full" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{unit.name}</h3>
              <p className="mt-1 text-sm text-muted">{facts.join(" · ")}</p>
              {unit.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted">{unit.description}</p>
              ) : null}
              {showPrice ? (
                <p className="mt-2 font-semibold">
                  {formatMoney(unit.baseRateCents, currency, locale as Locale)}{" "}
                  <span className="text-sm font-normal text-muted">{t("perNight")}</span>
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
