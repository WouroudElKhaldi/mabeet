import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listCategories } from "@/modules/admin/server";
import { Browse, searchParams as searchSchema, toPlaceSearch } from "@/modules/directory";
import { searchPlaces } from "@/modules/directory/server";

/** The most places one search page shows. */
const SEARCH_RESULTS = 48;

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("searchPage");
  return { title: t("title") };
}

/**
 * Search: where, when and how many, the categories and the filters, then the places that fit. The whole search lives
 * in the address, so it can be shared; anything wrong in it is dropped.
 */
export default async function SearchPage({ searchParams }: PageProps) {
  const search = searchSchema.parse(await searchParams);
  const [places, categories] = await Promise.all([
    searchPlaces(toPlaceSearch(search, SEARCH_RESULTS)),
    listCategories("HOME"),
  ]);
  return <Browse search={search} places={places} categories={categories} variant="search" />;
}
