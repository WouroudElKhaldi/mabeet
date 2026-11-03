import { ArrowRight, SearchX } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { SearchBar } from "@/components/site/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { categoryName } from "@/config/appearance";
import { searchHref } from "@/lib/search-url";
import type { SearchState } from "../schemas";
import type { PlaceCard as PlaceCardData } from "../types";
import { CategoryBar } from "./category-bar";
import { PlaceCard } from "./place-card";
import { ResultsGrid } from "./results-grid";

/**
 * The categories and filters, then the places found. The search page shows its own search bar and counts what it
 * found; the home page has the search bar in its hero and shows a short row with a link to see them all. Both read
 * the same `searchPlaces`, so they always agree.
 */
export async function Browse({
  search,
  places,
  categories,
  variant,
}: {
  search: SearchState;
  places: PlaceCardData[];
  /** The admin's place categories, in their order. */
  categories: Array<{ slug: string; nameEn: string; nameAr: string; icon: string }>;
  variant: "home" | "search";
}) {
  const [t, locale] = await Promise.all([getTranslations("searchPage"), getLocale()]);
  const named = categories.map((category) => ({
    slug: category.slug,
    name: categoryName(category, locale),
    icon: category.icon,
  }));
  const nameOf = new Map(named.map((category) => [category.slug, category.name]));
  // A place page opened from a search starts with the same stay picked.
  const query =
    search.checkIn && search.checkOut
      ? `?${new URLSearchParams({ checkIn: search.checkIn, checkOut: search.checkOut, guests: String(search.guests) })}`
      : "";
  const dated = query !== "";

  return (
    <div className="mx-auto max-w-360 px-4 sm:px-6 lg:px-10">
      {variant === "search" ? (
        <div className="flex justify-center pt-6">
          <SearchBar search={search} />
        </div>
      ) : null}
      <div className="mt-6 border-b border-line">
        <CategoryBar search={search} categories={named} />
      </div>

      {places.length === 0 ? (
        <div className="mt-10 grid place-items-center gap-4 rounded-2xl border border-line px-6 py-20 text-center">
          <SearchX className="size-10 text-faint" aria-hidden strokeWidth={1.4} />
          <p className="text-xl font-semibold">{t("emptyTitle")}</p>
          <p className="max-w-md text-muted">{t("emptyBody")}</p>
          <ButtonLink href="/assistant" variant="secondary">
            {t("askConcierge")}
          </ButtonLink>
        </div>
      ) : (
        <section className="mt-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            {variant === "search" ? (
              <h1 className="text-base font-semibold tracking-normal">
                {t(dated ? "freeHeading" : "heading", { count: places.length })}
              </h1>
            ) : (
              <>
                <h2 className="text-[1.375rem] font-semibold tracking-tight">{t("sections.homes")}</h2>
                <Link
                  href={searchHref(search)}
                  className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4"
                >
                  {t("seeAll")}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </>
            )}
          </div>
          <ResultsGrid>
            {places.map((place, index) => (
              <PlaceCard
                key={place.slug}
                place={place}
                categoryLabel={place.categories.map((slug) => nameOf.get(slug)).find(Boolean)}
                query={query}
                index={index}
              />
            ))}
          </ResultsGrid>
        </section>
      )}
    </div>
  );
}
