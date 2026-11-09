import { getTranslations } from "next-intl/server";
import { ShareButton } from "@/components/site/share-button";
import type { PublicPlace } from "../types";

/** The place's name, one line saying what it is and where, and a way to send the page to someone. */
export async function PlaceHeader({ place }: { place: Pick<PublicPlace, "name" | "area" | "bookingUnit"> }) {
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
      </div>
      {/* Pulled out to the edge, so it lines up with the title rather than sitting inside the button's padding. */}
      <ShareButton title={place.name} className="-me-3.5 shrink-0" />
    </header>
  );
}
