import { getTranslations } from "next-intl/server";
import { ShareButton } from "@/components/site/share-button";
import { RatingLine } from "@/modules/reviews";
import { FavoriteButton } from "./favorite-button";
import type { PublicPlace } from "../types";

/** The place's name, one line saying what it is and where, and the ways to keep or pass on the page. */
export async function PlaceHeader({
  place,
  saved,
  signedIn,
}: {
  place: Pick<PublicPlace, "name" | "slug" | "area" | "bookingUnit" | "rating">;
  saved: boolean;
  signedIn: boolean;
}) {
  const t = await getTranslations("placePage");
  const whole = place.bookingUnit === "WHOLE_PLACE";
  const kind = place.area
    ? t(whole ? "wholeHomeIn" : "roomsIn", { area: place.area })
    : t(whole ? "wholeHome" : "roomsHere");
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] leading-tight font-semibold">{place.name}</h1>
        <p className="mt-1 text-muted">{kind}</p>
        <RatingLine rating={place.rating} className="mt-2 text-sm" />
      </div>
      {/* Pulled out to the edge, so they line up with the title rather than sitting inside the button's padding. */}
      <div className="-me-3.5 flex shrink-0 items-center">
        <ShareButton title={place.name} />
        <FavoriteButton slug={place.slug} saved={saved} signedIn={signedIn} />
      </div>
    </header>
  );
}
