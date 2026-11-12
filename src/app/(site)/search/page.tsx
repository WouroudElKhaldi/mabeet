import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listCategories } from "@/modules/admin/server";
import { Browse, searchParams as searchSchema, toPlaceSearch } from "@/modules/directory";
import { browseOfferings, searchPlaces } from "@/modules/directory/server";
import { offeringKindOf } from "@/config/listing";

/** The most places one search page shows. */
const SEARCH_RESULTS = 48;

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("searchPage");
  return { title: t("title") };
}

/**
 * Search: where, when and how many, the categories and the filters, then the places that fit. The whole search lives
 * in the address, so it can be shared; anything wrong in it is dropped. The experiences and services tabs list those
 * instead, with their own categories.
 */
export default async function SearchPage({ searchParams }: PageProps) {
  const search = searchSchema.parse(await searchParams);
  const kind = offeringKindOf(search.tab);
  const [places, categories, offerings] = await Promise.all([
    kind ? [] : searchPlaces(toPlaceSearch(search, SEARCH_RESULTS)),
    listCategories(kind ?? "HOME"),
    kind ? browseOfferings(kind, SEARCH_RESULTS) : [],
  ]);
  return (
    <Browse search={search} places={places} categories={categories} offerings={offerings} variant="search" />
  );
}
