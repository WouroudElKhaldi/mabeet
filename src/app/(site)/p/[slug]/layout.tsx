import { notFound } from "next/navigation";
import { placeParams } from "@/modules/bookings";
import { loadPlace } from "@/modules/directory/server";

/**
 * A place that is unknown, suspended or not public is "not found" here, above the pages' loading screens. A page
 * under a loading screen starts streaming before it runs, so its own `notFound()` can no longer change the answer:
 * the visitor saw "not found" but search engines and shared links got 200. A layout runs before the stream starts,
 * so the answer is a real 404. `loadPlace` is cached for the request, so the page reads the same place again for free.
 */
export default async function PlaceLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const parsed = placeParams.safeParse(await params);
  if (!parsed.success || !(await loadPlace(parsed.data.slug))) notFound();
  return children;
}
