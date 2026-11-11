import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import type { Locale } from "@/config/appearance";
import { getPlacesOverview } from "@/modules/analytics/server";
import { AddPlaceButton } from "@/modules/workspaces";
import { requirePageUser } from "@/server/http/session";
import { formatMoney } from "@/utils/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("overviewAll");
  return { title: t("title"), robots: { index: false } };
}

const TOTALS = ["waiting", "arriving", "leaving", "inHouse"] as const;

/**
 * "All my places": every place this person works in, side by side, with today's numbers where their role reads
 * bookings. With one place they go straight to it; with none, to creating one.
 */
export default async function AllMyPlacesPage() {
  const user = await requirePageUser("/dashboard");
  const places = await getPlacesOverview(user.id);
  const [only] = places;
  if (!only) redirect("/host");
  if (places.length === 1) redirect(`/dashboard/${only.id}`);

  const [t, locale] = await Promise.all([getTranslations("overviewAll"), getLocale()]);
  const counts = (stats: NonNullable<(typeof places)[number]["stats"]>) => ({
    waiting: stats.waiting,
    arriving: stats.arrivingToday,
    leaving: stats.leavingToday,
    inHouse: stats.inHouse,
  });
  const total = (key: (typeof TOTALS)[number]) =>
    places.reduce((sum, place) => sum + (place.stats ? counts(place.stats)[key] : 0), 0);

  return (
    <AppShell
      nav={[
        {
          label: t("overview"),
          items: [{ href: "/dashboard", label: t("title"), icon: "overview", end: true }],
        },
        {
          label: t("yourPlaces"),
          items: places.map((place) => ({
            href: `/dashboard/${place.id}`,
            label: place.name,
            icon: "place" as const,
          })),
        },
      ]}
    >
      <PageHeader
        title={t("title")}
        intro={t("intro", { count: places.length })}
        actions={<AddPlaceButton />}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TOTALS.map((key) => (
          <div key={key} className="relative overflow-hidden rounded-xl bg-surface p-5 ring-1 ring-line">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-accent to-glow" aria-hidden />
            <p className="text-sm font-semibold text-muted">{t(`totals.${key}`)}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{total(key)}</p>
          </div>
        ))}
      </section>

      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {places.map((place) => (
          <li key={place.id}>
            <Link
              href={`/dashboard/${place.id}`}
              className="group block h-full rounded-xl bg-surface p-5 ring-1 ring-line transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{place.name}</p>
                  <p className="text-sm text-muted">{place.role}</p>
                </div>
                <ArrowRight
                  className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                  aria-hidden
                />
              </div>
              {place.stats ? (
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  {TOTALS.map((key) => {
                    const value = place.stats ? counts(place.stats)[key] : 0;
                    return (
                      <div key={key}>
                        <dt className="text-xs text-muted">{t(`totals.${key}`)}</dt>
                        <dd
                          className={
                            key === "waiting" && value > 0 ? "font-semibold text-warning" : "font-semibold"
                          }
                        >
                          {value}
                        </dd>
                      </div>
                    );
                  })}
                  <div>
                    <dt className="text-xs text-muted">{t("month")}</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatMoney(place.stats.monthRevenueCents, place.currency, locale as Locale)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-4 text-sm text-muted">{t("noAccess")}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
