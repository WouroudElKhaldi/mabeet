import { getTranslations } from "next-intl/server";
import { summarizeUnits } from "../summary";
import type { PublicPlace } from "../types";

/** How many guests the place sleeps, and its bedrooms, beds and bathrooms, in one line. */
export async function PlaceSummary({ place }: { place: Pick<PublicPlace, "units" | "bookingUnit"> }) {
  const t = await getTranslations("placePage");
  const { guests, bedrooms, beds, bathrooms } = summarizeUnits(place.units, place.bookingUnit);
  if (guests === 0) return null;
  const parts = [
    t("guestsCount", { count: guests }),
    t("bedrooms", { count: bedrooms }),
    t("beds", { count: beds }),
    t("baths", { count: bathrooms }),
  ];
  return <p className="text-lg font-semibold">{parts.join(" · ")}</p>;
}
