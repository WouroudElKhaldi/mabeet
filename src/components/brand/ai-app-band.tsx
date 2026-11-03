import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import type { Locale } from "@/config/appearance";
import { formatMoney } from "@/utils/format";
import { PlaceArt } from "./place-art";
import { Postmark } from "./postmark";

interface FoundPlace {
  slug: string;
  name: string;
  area: string | null;
  currency: string;
  nightlyFromCents: number;
  photo: { url: string; alt: string | null } | null;
}

/**
 * Using Mabeet from the guest's own AI app, shown as what it does: the trip described like a postcard, and tickets
 * for real places that came back. There is no chat on the website; the button leads to how to connect it. Painted in
 * the accent colour, so it follows the admin's palette.
 */
export async function AiAppBand({ found }: { found: FoundPlace[] }) {
  const [t, locale] = await Promise.all([getTranslations("home.concierge"), getLocale()]);

  return (
    <section className="mx-auto mt-24 max-w-360 px-4 sm:px-6 lg:px-10">
      <div className="relative isolate grid items-center gap-14 overflow-hidden rounded-3xl bg-accent px-6 py-12 text-accent-ink sm:px-12 sm:py-16 lg:grid-cols-[1fr_minmax(0,30rem)]">
        {/* A run of faint arches along the bottom, like the hero. */}
        <svg
          aria-hidden
          viewBox="0 0 600 200"
          className="absolute start-0 -bottom-6 -z-10 w-[min(48rem,90%)] opacity-15"
        >
          {[0, 1, 2, 3, 4].map((index) => (
            <path
              key={index}
              d={`M${20 + index * 120} 200 V90 a50 50 0 0 1 100 0 V200`}
              className="fill-none stroke-current"
              strokeWidth="6"
            />
          ))}
        </svg>

        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase opacity-80">{t("eyebrow")}</p>
          <h2 className="mt-4 max-w-lg font-poster text-[clamp(2rem,3.6vw,3rem)]">{t("title")}</h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed opacity-85">{t("body")}</p>
          <p className="mt-5 text-sm opacity-80">{t("languages")} English · العربية · Arabizi</p>
          <ButtonLink href="/assistant" size="lg" className="mt-8 bg-paper text-ink hover:bg-paper/90">
            <Sparkles className="size-5" aria-hidden />
            {t("cta")}
          </ButtonLink>
        </div>

        {/* What the guest writes, as a postcard; what comes back, as tickets. */}
        <div className="relative text-ink">
          <div className="relative -rotate-2 rounded-md bg-paper p-6 pe-24 shadow-[0_24px_40px_-18px_rgb(0_0_0/0.5)]">
            <Postmark className="absolute end-4 top-4 size-16 rotate-12" />
            <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-muted uppercase">
              {t("postcard")}
            </p>
            <p className="ruled mt-3 text-[1.0625rem] leading-[1.85rem]">{t("sampleQuestion")}</p>
          </div>

          {found.length > 0 && (
            <ul className="relative mt-5 grid gap-3 ps-6 sm:ps-10">
              {found.map((place, index) => (
                <li
                  key={place.slug}
                  className={index === 0 ? "rotate-1" : "-rotate-1"}
                  style={{ marginInlineStart: index * 12 }}
                >
                  <Link
                    href={`/p/${place.slug}`}
                    className="group flex overflow-hidden rounded-xl bg-surface shadow-[0_18px_30px_-16px_rgb(0_0_0/0.5)] transition-transform hover:-translate-y-0.5"
                  >
                    <div className="relative w-24 shrink-0 bg-surface-2 sm:w-28">
                      {place.photo ? (
                        <Image
                          src={place.photo.url}
                          alt={place.photo.alt ?? place.name}
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                      ) : (
                        <PlaceArt seed={place.slug} className="size-full" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 border-s-2 border-dashed border-line-strong px-4 py-3">
                      <p className="text-[0.625rem] font-bold tracking-[0.16em] text-accent uppercase">
                        {t("found")}
                      </p>
                      <p className="mt-1 truncate font-semibold">{place.name}</p>
                      <p className="truncate text-sm text-muted">
                        {place.area ? `${place.area} · ` : ""}
                        {formatMoney(place.nightlyFromCents, place.currency, locale as Locale)}{" "}
                        {t("perNight")}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
