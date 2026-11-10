import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { placeParams } from "@/modules/bookings";
import { initialStay, PlaceView } from "@/modules/directory";
import { isPlaceSaved, loadPlace } from "@/modules/directory/server";
import { getCurrentUser } from "@/server/http/session";

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
  const { slug } = placeParams.parse(await params);
  const [place, user] = await Promise.all([loadPlace(slug), getCurrentUser()]);
  if (!place) notFound();
  return (
    <PlaceView
      place={place}
      initial={initialStay(await searchParams)}
      saved={user ? await isPlaceSaved(user.id, slug) : false}
      signedIn={user !== null}
    />
  );
}
