// Long lists are read a page at a time, and each page is its own address (`?page=2`), so a page survives a reload
// and the filters travel with it.

/** Rows on one page of a list. */
export const PAGE_SIZE = 20;

/** The page to show, held to the pages there are (a page past the end shows the last), and the rows to skip for it. */
export function pageOf(total: number, page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page)), pages);
  return { page: current, pages, skip: (current - 1) * size, take: size };
}

/**
 * A list's address with its filters and a page: empty filters are left out, and page 1 is the bare address, so
 * the first page has one address only.
 */
export function listHref(path: string, filters: Record<string, string | undefined>, page = 1): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
