import { getTranslations } from "next-intl/server";
import type { PublicPlace } from "../types";

/** The place's name, and one line saying what it is and where. */
export async function PlaceHeader({ place }: { place: Pick<PublicPlace, "name" | "area" | "bookingUnit"> }) {
  const t = await getTranslations("placePage");
  const whole = place.bookingUnit === "WHOLE_PLACE";
  const kind = place.area
    ? t(whole ? "wholeHomeIn" : "roomsIn", { area: place.area })
    : t(whole ? "wholeHome" : "roomsHere");
  return (
    <header>
      <h1 className="text-[1.75rem] leading-tight font-semibold">{place.name}</h1>
      <p className="mt-1 text-muted">{kind}</p>
    </header>
  );
}
