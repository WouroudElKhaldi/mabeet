// The page each page belongs to: where its Back button goes when the person did not come from another page of ours in
// this tab (a shared link, a new tab, a notification). Otherwise Back returns to the page they came from.

/** Pages with no parent: the home page and each area's own home. */
const AREA_HOMES = [/^\/$/, /^\/dashboard$/, /^\/dashboard\/[^/]+$/, /^\/admin$/];

/** Detail pages whose URL prefix is not a page itself: a listing belongs to search, a booking to your trips. */
const DETAIL_PARENTS: Array<[RegExp, string]> = [
  [/^\/[po]\/[^/]+$/, "/search"],
  [/^\/b\/[^/]+$/, "/account"],
];

export function parentPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (AREA_HOMES.some((home) => home.test(path))) return null;
  const detail = DETAIL_PARENTS.find(([pattern]) => pattern.test(path));
  if (detail) return detail[1];
  return path.slice(0, path.lastIndexOf("/")) || "/";
}
