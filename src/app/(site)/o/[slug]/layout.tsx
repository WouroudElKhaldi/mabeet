import { notFound } from "next/navigation";
import { experienceParams } from "@/modules/bookings";
import { loadOffering } from "@/modules/directory/server";

/**
 * An experience or service that is unknown, switched off or at a closed place is "not found" here, above the loading
 * screen, so the answer is a real 404 (a page under a loading screen has already started its 200). `loadOffering` is
 * cached for the request, so the page reads the same offering again for free.
 */
export default async function OfferingLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const parsed = experienceParams.safeParse(await params);
  if (!parsed.success || !(await loadOffering(parsed.data.slug))) notFound();
  return children;
}
