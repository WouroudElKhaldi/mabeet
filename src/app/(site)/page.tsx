import { BadgePercent, CalendarCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AiAppBand } from "@/components/brand/ai-app-band";
import { ArchWindow } from "@/components/brand/arch-window";
import { BoardingPass } from "@/components/brand/boarding-pass";
import { BrandScene, SceneLayer } from "@/components/brand/brand-scene";
import { DirectReceipts } from "@/components/brand/direct-receipts";
import { Postmark } from "@/components/brand/postmark";
import { SearchBar } from "@/components/site/search-bar";
import type { Locale } from "@/config/appearance";
import { listCategories } from "@/modules/admin/server";
import { Browse, searchParams as searchSchema, toPlaceSearch } from "@/modules/directory";
import { browseOfferings, searchPlaces } from "@/modules/directory/server";
import { offeringKindOf } from "@/config/listing";
import { addDays, todayUtc } from "@/utils/dates";
import { formatMoney, formatStayDates } from "@/utils/format";
import { stagger } from "@/utils/motion";

/** How many places the home page shows before "See all". */
const HOME_RESULTS = 12;
const WEEKEND_NIGHTS = 2;

/** The coming Friday (or the one after, if today is Friday), for the sample boarding pass. */
function nextFriday(today: Date): Date {
  return addDays(today, (5 - today.getUTCDay() + 7) % 7 || 7);
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The poster hero with the search bar and real listings in the triple-arch window, then the places to browse, then
 * the case for booking direct, and asking for a place from the guest's own AI app.
 */
export default async function HomePage({ searchParams }: PageProps) {
  const search = searchSchema.parse(await searchParams);
  const kind = offeringKindOf(search.tab);
  const [t, locale, places, categories, offerings, found] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    // The places are read on every tab: the hero is built from them.
    searchPlaces(toPlaceSearch(search, HOME_RESULTS)),
    listCategories(kind ?? "HOME"),
    kind ? browseOfferings(kind, HOME_RESULTS) : [],
    // The same search the sample postcard asks for: a mountain stay for two under $120 a night.
    searchPlaces({ guests: 2, categories: ["mountain"], maxRateCents: 12_000, limit: 2 }),
  ]);
  // The hero is built from real listings: their photos in the arches, one of them on the pass.
  const featured = places[1] ?? places[0];
  const checkIn = nextFriday(todayUtc());
  const checkOut = addDays(checkIn, WEEKEND_NIGHTS);

  return (
    <>
      <section className="mx-auto grid max-w-360 items-center gap-12 overflow-x-clip px-4 pt-10 pb-6 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-10 lg:pt-14">
        <div className="min-w-0">
          <p className="rise-in inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
            <BadgePercent className="size-4" aria-hidden />
            {t("eyebrow")}
          </p>
          <h1
            className="rise-in mt-5 max-w-2xl font-poster text-[clamp(2.5rem,5.4vw,4.5rem)] leading-[0.98] font-extrabold [font-stretch:118%] rtl:[font-stretch:100%]"
            style={stagger(1)}
          >
            {t.rich("title", { em: (chunk) => <em>{chunk}</em> })}
          </h1>
          <p className="rise-in mt-5 max-w-xl text-lg leading-relaxed text-muted" style={stagger(2)}>
            {t("subtitle")}
          </p>
          <div className="rise-in relative z-20 mt-8" style={stagger(3)}>
            <SearchBar search={search} />
          </div>
        </div>

        {/* The window leans with the mouse, its hills slide by depth, and the postmark is stamped in front. The pass is
            taller than the window on a laptop and rises above it: the top padding keeps it clear of the header. */}
        <BrandScene className="mx-auto hidden w-full max-w-xl pt-44 pb-16 lg:block xl:pt-32">
          <SceneLayer enter="rise">
            <ArchWindow
              photos={places.slice(0, 3).map((place) => place.photo)}
              seed="hero"
              priority
              className="ms-auto w-[78%]"
            />
          </SceneLayer>
          <SceneLayer depth={90} enter="stamp" className="absolute end-0 -top-8 size-28">
            <Postmark className="size-full rotate-12" spin />
          </SceneLayer>
          {featured ? (
            <SceneLayer
              depth={60}
              enter="drop"
              className="absolute -start-10 bottom-0 w-64 -rotate-3 2xl:-start-24"
            >
              <BoardingPass
                kicker={t("pass.kicker")}
                title={featured.name}
                subtitle={featured.area}
                fields={[
                  { label: t("pass.dates"), value: formatStayDates(checkIn, checkOut, locale as Locale) },
                  { label: t("pass.guests"), value: "2" },
                  {
                    label: t("pass.total"),
                    value: formatMoney(
                      featured.nightlyFromCents * WEEKEND_NIGHTS,
                      featured.currency,
                      locale as Locale,
                    ),
                  },
                  { label: t("pass.fees"), value: formatMoney(0, featured.currency, locale as Locale) },
                ]}
                stub={
                  <p className="flex items-center gap-2 text-sm font-semibold text-accent">
                    <CalendarCheck className="size-4" aria-hidden />
                    {t("pass.heldNote")}
                  </p>
                }
              />
            </SceneLayer>
          ) : null}
        </BrandScene>
      </section>

      <Browse search={search} places={places} categories={categories} offerings={offerings} variant="home" />

      <DirectReceipts />

      <AiAppBand found={found} />
    </>
  );
}
