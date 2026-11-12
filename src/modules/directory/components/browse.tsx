import { ArrowRight, SearchX } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { SearchBar } from "@/components/site/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { ChoiceLinks } from "@/components/ui/choice-links";
import { categoryName } from "@/config/appearance";
import { BROWSE_TABS, type BrowseTab } from "@/config/listing";
import { searchHref } from "@/lib/search-url";
import type { SearchState } from "../schemas";
import type { OfferingCard as OfferingCardData, PlaceCard as PlaceCardData } from "../types";
import { CategoryBar } from "./category-bar";
import { OfferingCard } from "./offering-card";
import { PlaceCard } from "./place-card";
import { ResultsGrid } from "./results-grid";

interface BrowseCategory {
  slug: string;
  nameEn: string;
  nameAr: string;
  icon: string;
}

/**
 * The tabs (places to stay, experiences, services), then for places the categories and filters and the places found,
 * and for the other two their cards, the ones with a date coming first. The search page shows its own search bar and counts what it
 * found; the home page has the search bar in its hero and shows a short row with a link to see them all. Both read
 * the same `searchPlaces`, so they always agree.
 */
export async function Browse({
  search,
  places,
  categories,
  offerings = [],
  variant,
}: {
  search: SearchState;
  places: PlaceCardData[];
  /** The admin's categories of the tab shown (places, experiences or services), in their order. */
  categories: BrowseCategory[];
  /** The experiences or services of the tab shown; unused on the places tab. */
  offerings?: OfferingCardData[];
  variant: "home" | "search";
}) {
  const [t, tTabs, locale] = await Promise.all([
    getTranslations("searchPage"),
    getTranslations("listing.tabs"),
    getLocale(),
  ]);
  // The home page keeps its tabs on itself; the search page keeps the rest of the search with them.
  const tabHref = (tab: BrowseTab) =>
    variant === "home" ? (tab === "homes" ? "/" : `/?tab=${tab}`) : searchHref({ ...search, tab });
  const tabs = (
    <ChoiceLinks
      label={t("tabsLabel")}
      choices={BROWSE_TABS.map((tab) => ({
        href: tabHref(tab),
        label: tTabs(tab),
        current: tab === search.tab,
      }))}
    />
  );
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
      <div className="mt-6">{tabs}</div>
      {search.tab !== "homes" ? (
        <OfferingResults
          tab={search.tab}
          offerings={offerings}
          nameOf={nameOf}
          variant={variant}
          seeAllHref={searchHref({ tab: search.tab })}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

/** The experiences or services tab: a grid of their cards, or a calm line when hosts have added none yet. */
async function OfferingResults({
  tab,
  offerings,
  nameOf,
  variant,
  seeAllHref,
}: {
  tab: Exclude<BrowseTab, "homes">;
  offerings: OfferingCardData[];
  nameOf: Map<string, string>;
  variant: "home" | "search";
  seeAllHref: string;
}) {
  const t = await getTranslations("searchPage");
  if (offerings.length === 0) {
    return (
      <div className="mt-8 grid place-items-center gap-4 rounded-2xl border border-line px-6 py-20 text-center">
        <SearchX className="size-10 text-faint" aria-hidden strokeWidth={1.4} />
        <p className="text-xl font-semibold">{t("offeringsEmptyTitle")}</p>
        <p className="max-w-md text-muted">{t("offeringsEmptyBody")}</p>
        <ButtonLink href={variant === "home" ? "/" : searchHref({})} variant="secondary">
          {t("browseHomes")}
        </ButtonLink>
      </div>
    );
  }
  const Heading = variant === "search" ? "h1" : "h2";
  return (
    <section className="mt-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <Heading className="text-[1.375rem] font-semibold tracking-tight">{t(`sections.${tab}`)}</Heading>
        {variant === "home" ? (
          <Link
            href={seeAllHref}
            className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4"
          >
            {t("seeAll")}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        ) : null}
      </div>
      <ResultsGrid>
        {offerings.map((offering, index) => (
          <OfferingCard
            key={offering.slug}
            offering={offering}
            categoryLabel={offering.categorySlug ? nameOf.get(offering.categorySlug) : undefined}
            index={index}
          />
        ))}
      </ResultsGrid>
    </section>
  );
}
