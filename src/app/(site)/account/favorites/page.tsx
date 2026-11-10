import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { categoryName } from "@/config/appearance";
import { AccountHeader } from "@/modules/accounts";
import { FavoriteButton, PlaceCard, ResultsGrid } from "@/modules/directory";
import { listMyFavorites } from "@/modules/directory/server";
import { listCategories } from "@/modules/admin/server";
import { requirePageUser } from "@/server/http/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("tabs.favorites") };
}

/**
 * The places a guest saved, the newest first, with each heart ready to take one off again. Prices are a night's,
 * not a stay's: a saved place is kept for later, when the dates are not decided yet.
 */
export default async function FavoritesPage() {
  const user = await requirePageUser("/account/favorites");
  const [t, locale, places, categories] = await Promise.all([
    getTranslations("account"),
    getLocale(),
    listMyFavorites(user.id),
    listCategories("HOME"),
  ]);
  const named = new Map(categories.map((category) => [category.slug, categoryName(category, locale)]));

  return (
    <div className="mx-auto max-w-280 px-4 pt-10 pb-16 sm:px-6 lg:px-10">
      <AccountHeader name={user.name} />
      <div className="mt-10">
        {places.length === 0 ? (
          <div className="flex max-w-3xl flex-col items-start gap-4 rounded-xl bg-surface-2 p-6">
            <p className="text-lg font-semibold">{t("noFavorites")}</p>
            <p className="text-muted">{t("noFavoritesHint")}</p>
            <ButtonLink href="/search">{t("explore")}</ButtonLink>
          </div>
        ) : (
          <ResultsGrid>
            {places.map((place, index) => (
              <PlaceCard
                key={place.slug}
                place={place}
                index={index}
                categoryLabel={place.categories[0] ? named.get(place.categories[0]) : undefined}
                action={<FavoriteButton slug={place.slug} saved signedIn onPhoto />}
              />
            ))}
          </ResultsGrid>
        )}
      </div>
    </div>
  );
}
