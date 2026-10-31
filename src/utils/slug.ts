import { secureToken } from "./tokens";

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * A URL slug from a name that no other row uses yet: the plain slug when it's free, otherwise with a short
 * random suffix. `isTaken` checks the table the slug is for.
 */
export async function uniqueSlug(
  name: string,
  fallback: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name) || fallback;
  if (!(await isTaken(base))) return base;
  const suffix = secureToken(4)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${base}-${suffix}`;
}
