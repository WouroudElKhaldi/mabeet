import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { placeParams } from "@/modules/bookings";
import { groupPhotos, PhotoTour } from "@/modules/directory";
import { loadPlace } from "@/modules/directory/server";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const place = await loadPlace(placeParams.parse(await params).slug);
  if (!place) return {};
  const t = await getTranslations("photoTour");
  return { title: `${t("title")} · ${place.name}` };
}

/** The photo tour: every photo of a place, grouped by the part of the house and by room. */
export default async function PhotoTourPage({ params }: PageProps) {
  const place = await loadPlace(placeParams.parse(await params).slug);
  if (!place) notFound();
  const t = await getTranslations("photoTour");

  return (
    <div className="mx-auto max-w-280 px-4 pt-6 pb-16 sm:px-6 lg:px-10">
      <h1 className="font-poster text-[clamp(1.75rem,3vw,2.5rem)]">{place.name}</h1>
      <p className="mt-1 text-muted">{t("title")}</p>
      <div className="mt-10">
        <PhotoTour name={place.name} groups={groupPhotos(place.photos, place.units)} />
      </div>
    </div>
  );
}
