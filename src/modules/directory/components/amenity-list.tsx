import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ShowAllDialog } from "@/components/ui/show-all-dialog";
import { amenitiesOf } from "../summary";
import type { PublicUnit } from "../types";

const SHOWN = 6;

/** What the place offers: the first six, and "Show all" for the rest. Nothing at all when no room lists any. */
export async function AmenityList({ units }: { units: readonly PublicUnit[] }) {
  const t = await getTranslations("placePage");
  const amenities = amenitiesOf(units);
  if (amenities.length === 0) return null;
  const list = (items: typeof amenities) => (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((amenity) => (
        <li key={amenity} className="flex items-center gap-3">
          <Check className="size-5 shrink-0 text-accent" aria-hidden />
          {t(`amenity.${amenity}`)}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex flex-col gap-5">
      {list(amenities.slice(0, SHOWN))}
      {amenities.length > SHOWN ? (
        <div>
          <ShowAllDialog label={t("showAllAmenities", { count: amenities.length })} title={t("amenities")}>
            {list(amenities)}
          </ShowAllDialog>
        </div>
      ) : null}
    </div>
  );
}
