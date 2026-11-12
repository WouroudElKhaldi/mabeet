import type { BrowseTab } from "@/config/listing";

// One way to turn a search into a /search address, shared by the search bar, the categories and the filters, so a
// search can always be shared as a link.

/** A search as the address holds it (`searchParams` in the directory module reads it back), every part optional. */
export interface SearchLink {
  q?: string;
  area?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  category?: string[];
  tags?: string[];
  amenities?: string[];
  access?: string[];
  minPrice?: number;
  maxPrice?: number;
  /** Places to stay (the default), experiences or services. */
  tab?: BrowseTab;
}

/** The address of a search. Empty values and the defaults are left out, so links stay short. */
export function searchHref(search: SearchLink): string {
  const params = new URLSearchParams();
  const put = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  };
  put("q", search.q);
  put("area", search.area);
  put("checkIn", search.checkIn);
  put("checkOut", search.checkOut);
  put("guests", search.guests && search.guests > 1 ? search.guests : undefined);
  for (const key of ["category", "tags", "amenities", "access"] as const) put(key, search[key]?.join(","));
  put("minPrice", search.minPrice);
  put("maxPrice", search.maxPrice);
  put("tab", search.tab === "homes" ? undefined : search.tab);
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

/** How many filters are on beyond the words, dates and guests, for the badge on the Filters button. */
export function activeFilterCount(search: SearchLink): number {
  return (
    (search.category?.length ?? 0) +
    (search.tags?.length ?? 0) +
    (search.amenities?.length ?? 0) +
    (search.access?.length ?? 0) +
    (search.minPrice !== undefined ? 1 : 0) +
    (search.maxPrice !== undefined ? 1 : 0)
  );
}
