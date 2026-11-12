import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { categoryName } from "@/config/appearance";
import { listCategories } from "@/modules/admin/server";
import { experienceParams } from "@/modules/bookings";
import { OfferingView } from "@/modules/directory";
import { loadOffering } from "@/modules/directory/server";
import { getCurrentUser } from "@/server/http/session";
import { signInUrl } from "@/utils/sign-in-url";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const offering = await loadOffering(experienceParams.parse(await params).slug);
  if (!offering) return {};
  return { title: offering.title, description: offering.description?.slice(0, 160) };
}

/**
 * An experience or service's public page: what it is, what to know, where you meet, and its next sessions with the
 * seats left in each. Booking needs an account, so a signed-out visitor is offered to sign in and come back here.
 */
export default async function OfferingPage({ params }: PageProps) {
  const { slug } = experienceParams.parse(await params);
  const [offering, user, locale] = await Promise.all([loadOffering(slug), getCurrentUser(), getLocale()]);
  if (!offering) notFound();
  const category = offering.categorySlug
    ? (await listCategories(offering.kind)).find((candidate) => candidate.slug === offering.categorySlug)
    : undefined;
  return (
    <OfferingView
      offering={offering}
      categoryLabel={category ? categoryName(category, locale) : undefined}
      defaults={{ name: user?.name ?? "", email: user?.email ?? "" }}
      signInHref={user ? null : signInUrl(`/o/${slug}`)}
    />
  );
}
