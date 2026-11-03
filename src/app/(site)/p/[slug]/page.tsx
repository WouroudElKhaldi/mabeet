import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { placeParams } from "@/modules/bookings";
import { initialStay, PlaceView } from "@/modules/directory";
import { getPlace } from "@/modules/directory/server";

// The page and its title both ask for the place; asked twice in one request it is read once.
const loadPlace = cache(getPlace);

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const place = await loadPlace(placeParams.parse(await params).slug);
  if (!place) return {};
  const t = await getTranslations("placePage");
  const description =
    place.description?.slice(0, 160) ??
    (place.area
      ? t(place.bookingUnit === "WHOLE_PLACE" ? "wholeHomeIn" : "roomsIn", { area: place.area })
      : undefined);
  return { title: place.name, description };
}

/**
 * A guesthouse's public page, at the link its host shares: photos, rooms, what it offers, and where a guest picks
 * dates and books. A stay can arrive in the address (?room=&checkIn=&checkOut=&guests=) from a search or a shared
 * link; whatever does not fit is dropped.
 */
export default async function PlacePage({ params, searchParams }: PageProps) {
  const place = await loadPlace(placeParams.parse(await params).slug);
  if (!place) notFound();
  return <PlaceView place={place} initial={initialStay(await searchParams)} />;
}
