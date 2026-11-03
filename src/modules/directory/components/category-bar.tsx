import { clsx } from "clsx";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScrollRail } from "@/components/ui/scroll-rail";
import { categoryIcon } from "@/config/category-icons";
import { type SearchLink, searchHref } from "@/lib/search-url";
import { FiltersDialog } from "./filters-dialog";

interface BrowseCategory {
  slug: string;
  /** In the reader's language. */
  name: string;
  icon: string;
}

/** The place categories as icon tabs (picking one searches it, picking it again lets go), then the Filters button. */
export async function CategoryBar({
  search,
  categories,
}: {
  search: SearchLink;
  categories: BrowseCategory[];
}) {
  const t = await getTranslations("filters");
  return (
    <div className="flex items-center gap-6">
      <ScrollRail label={t("categories")} labels={{ previous: t("previous"), next: t("next") }}>
        {categories.map((category) => {
          const selected = search.category?.includes(category.slug) ?? false;
          const Icon = categoryIcon(category.icon);
          return (
            <Link
              key={category.slug}
              href={searchHref({ ...search, category: selected ? [] : [category.slug] })}
              aria-current={selected ? "page" : undefined}
              className={clsx(
                "flex shrink-0 flex-col items-center gap-1.5 border-b-2 pt-1 pb-2.5 text-xs font-semibold whitespace-nowrap transition-colors",
                selected
                  ? "border-ink text-ink"
                  : "border-transparent text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              <Icon className="size-6" aria-hidden strokeWidth={1.6} />
              {category.name}
            </Link>
          );
        })}
      </ScrollRail>
      <FiltersDialog search={search} categories={categories} />
    </div>
  );
}
