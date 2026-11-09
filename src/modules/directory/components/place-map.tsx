import { getTranslations } from "next-intl/server";
import type { PublicPlace } from "../types";

/**
 * Where you'll be: the area, and a map around it. The place's own coordinates are the host's, which may be no more
 * than their town, so the map is centred on them without a pin on a door, and the page says the area is
 * approximate. Nothing is shown at all until a host has given coordinates.
 */
export async function PlaceMap({
  place,
}: {
  place: Pick<PublicPlace, "name" | "area" | "latitude" | "longitude">;
}) {
  const t = await getTranslations("placePage");
  const { latitude, longitude } = place;
  if (latitude === null || longitude === null) return null;
  // Google's own embed, which needs no key. The CSP allows maps.google.com and nothing else to be framed.
  const map = new URL("https://maps.google.com/maps");
  map.searchParams.set("q", `${latitude},${longitude}`);
  map.searchParams.set("z", "13");
  map.searchParams.set("output", "embed");

  return (
    <div className="grid gap-3">
      {place.area ? <p className="font-semibold">{place.area}</p> : null}
      <iframe
        src={map.toString()}
        title={t("mapOf", { place: place.name })}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="aspect-4/3 w-full rounded-xl ring-1 ring-line sm:aspect-video"
      />
      <p className="text-sm text-muted">{t("approximate")}</p>
    </div>
  );
}
