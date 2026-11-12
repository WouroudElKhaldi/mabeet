import { Clock, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PlaceArt } from "@/components/brand/place-art";
import { Section } from "@/components/site/section";
import { ShareButton } from "@/components/site/share-button";
import { ButtonLink } from "@/components/ui/button";
import type { Locale } from "@/config/appearance";
import { isOnlineMode } from "@/config/enums";
import { ACCESSIBILITY, LANGUAGES, TAGS } from "@/config/listing";
import { formatMoney } from "@/utils/format";
import { durationText } from "../offering-text";
import type { PublicOffering } from "../types";
import { PlaceMap } from "./place-map";
import { SessionBookingCard } from "./session-booking-card";

/** Keeps the keys we know, in the list's own order, so an old or mistyped value never shows as raw text. */
function known<Key extends string>(allowed: readonly Key[], values: readonly string[]): Key[] {
  return allowed.filter((key) => values.includes(key));
}

/**
 * An experience or service's page, laid out like a place's: the title row, its photo, what it is and what to know,
 * where you meet, and the card where the guest picks a session and books. On a phone the card comes after the text,
 * and a bar held at the bottom leads to it.
 */
export async function OfferingView({
  offering,
  categoryLabel,
  defaults,
  signInHref,
}: {
  offering: PublicOffering;
  /** Its category, in the reader's language. */
  categoryLabel?: string;
  /** What the account already knows, so a signed-in guest types less. */
  defaults: { name: string; email: string };
  /** Where a signed-out visitor signs in first; null once signed in. */
  signInHref: string | null;
}) {
  const [t, tOffer, tKnow, tListing, tRefund, locale] = await Promise.all([
    getTranslations("offeringPage"),
    getTranslations("offering"),
    getTranslations("thingsToKnow"),
    getTranslations("listing"),
    getTranslations("refundPolicy"),
    getLocale(),
  ]);
  const service = offering.kind === "SERVICE";
  const tags = known(TAGS, offering.tags);
  const accessibility = known(ACCESSIBILITY, offering.accessibility);
  const languages = known(LANGUAGES, offering.languages);
  const activity = offering.activityLevel ? tListing(`activity.${offering.activityLevel}`) : null;
  const skill = offering.skillLevel ? tListing(`skill.${offering.skillLevel}`) : null;
  const cover = offering.photos[0];
  const facts = [
    durationText(tOffer, offering.durationMinutes),
    t("upTo", { count: offering.maxGuests }),
    ...(languages.length > 0 ? [languages.map((code) => tListing(`languages.${code}`)).join(", ")] : []),
  ];

  const rows = [
    {
      label: tKnow("requirements"),
      body: offering.minAge
        ? tKnow("requirementsAge", { age: offering.minAge, max: offering.maxGuests })
        : tKnow("requirementsMax", { max: offering.maxGuests }),
    },
    ...(activity
      ? [
          {
            label: tKnow("activity"),
            body: skill ? tKnow("activityBody", { activity, skill }) : tKnow("activityOnly", { activity }),
          },
        ]
      : []),
    ...(offering.included.length > 0
      ? [{ label: tKnow("included"), body: offering.included.join("\n") }]
      : []),
    ...(offering.notIncluded.length > 0
      ? [{ label: tKnow("notIncluded"), body: offering.notIncluded.join("\n") }]
      : []),
    {
      label: tKnow("accessibility"),
      body:
        accessibility.length > 0
          ? accessibility.map((key) => tListing(`accessibility.${key}`)).join("\n")
          : tKnow("noAccessibility"),
    },
    // The one refund rule, as on a place's page: an experience has no cancellation setting of its own.
    { label: tKnow("cancellation"), body: tRefund("full") },
  ];

  return (
    <div className="mx-auto max-w-280 px-4 pt-6 sm:px-6 lg:px-10 lg:pb-16">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-semibold">{offering.title}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
            {categoryLabel ? <span className="font-semibold text-ink">{categoryLabel}</span> : null}
            {offering.area ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {offering.area}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {durationText(tOffer, offering.durationMinutes)}
            </span>
          </p>
        </div>
        <div className="-me-3.5 flex shrink-0 items-center">
          <ShareButton title={offering.title} />
        </div>
      </header>

      <div className="relative mt-6 aspect-4/3 overflow-hidden rounded-2xl bg-surface-2 sm:aspect-video">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt ?? offering.title}
            fill
            priority
            sizes="(min-width: 1120px) 1120px, 100vw"
            className="object-cover"
          />
        ) : (
          <PlaceArt seed={offering.slug} className="size-full" />
        )}
      </div>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-20">
        <div className="flex min-w-0 flex-col gap-10">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-[1.375rem] font-semibold">
                {offering.area
                  ? t(service ? "serviceIn" : "experienceIn", { area: offering.area })
                  : t(service ? "service" : "experience")}
              </h2>
              <p className="mt-1 text-muted">{facts.join(" · ")}</p>
              <p className="mt-2 text-sm">
                <Link
                  href={`/p/${encodeURIComponent(offering.business.slug)}`}
                  className="font-semibold underline underline-offset-4"
                >
                  {t("hostedBy", { name: offering.business.name })}
                </Link>
              </p>
            </div>
            {offering.description ? (
              <p className="leading-relaxed whitespace-pre-line">{offering.description}</p>
            ) : null}
            {tags.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label={t("tags")}>
                {tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-line-strong"
                  >
                    {tListing(`tags.${tag}`)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <Section id="things-to-know" title={tKnow("title")}>
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {rows.map(({ label, body }) => (
                <div key={label}>
                  <dt className="text-sm font-semibold text-muted">{label}</dt>
                  <dd className="mt-1 whitespace-pre-line">{body}</dd>
                </div>
              ))}
            </dl>
          </Section>

          {offering.meetingPoint || (offering.latitude !== null && offering.longitude !== null) ? (
            <Section id="where" title={t("whereYouMeet")}>
              {offering.meetingPoint ? <p className="mb-3 font-semibold">{offering.meetingPoint}</p> : null}
              <PlaceMap
                place={{
                  name: offering.title,
                  area: offering.meetingPoint ? null : offering.area,
                  latitude: offering.latitude,
                  longitude: offering.longitude,
                }}
              />
            </Section>
          ) : null}
        </div>

        <aside id="booking" className="scroll-mt-28 lg:sticky lg:top-28 lg:self-start">
          <SessionBookingCard
            offering={{
              ...offering,
              currency: offering.business.currency,
              timezone: offering.business.timezone,
            }}
            online={isOnlineMode(offering.bookingMode)}
            defaults={defaults}
            signInHref={signInHref}
          />
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-12 flex items-center justify-between gap-4 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 lg:hidden">
        <p className="font-semibold">
          {formatMoney(offering.priceCents, offering.business.currency, locale as Locale)}{" "}
          <span className="text-sm font-normal text-muted">
            {offering.priceUnit === "PER_PERSON" ? tOffer("perPerson") : tOffer("perGroup")}
          </span>
        </p>
        <ButtonLink href="#booking">{t("chooseTime")}</ButtonLink>
      </div>
    </div>
  );
}
