import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { TicketCard } from "@/components/brand/ticket-card";
import { ArrowLink } from "@/components/ui/arrow-link";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import type { Locale } from "@/config/appearance";
import { placeParams } from "@/modules/bookings";
import {
  acceptsMessages,
  ContactHostForm,
  hostDisplayName,
  initialStay,
  offersWhatsapp,
  responseSpeed,
} from "@/modules/directory";
import { loadPlace } from "@/modules/directory/server";
import { formatStayDates } from "@/utils/format";
import { parseIsoDate } from "@/utils/dates";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const place = await loadPlace(placeParams.parse(await params).slug);
  if (!place) return {};
  const t = await getTranslations("contactHost");
  return { title: t("metaTitle", { place: place.name }) };
}

/**
 * Contact host: what guests usually ask answered first (getting there, how paying works, the refund rule, the house
 * rules), so most guests never need to write, then the ways this host takes questions. A stay carried in the address
 * travels with the question, so the host answers about the right nights.
 */
export default async function ContactHostPage({ params, searchParams }: PageProps) {
  const place = await loadPlace(placeParams.parse(await params).slug);
  if (!place) notFound();

  const [t, known, refund, locale] = await Promise.all([
    getTranslations("contactHost"),
    getTranslations("placePage"),
    getTranslations("refundPolicy"),
    getLocale(),
  ]);
  const meet = await getTranslations("meetHost");
  const { host } = place;
  const hostName = hostDisplayName(place);
  const stay = initialStay(await searchParams);
  const nights =
    stay.checkIn && stay.checkOut
      ? formatStayDates(parseIsoDate(stay.checkIn), parseIsoDate(stay.checkOut), locale as Locale)
      : null;
  const whatsapp = offersWhatsapp(host.contactBy) ? place.whatsapp : null;
  const takesMessages = acceptsMessages(host.contactBy, place.whatsapp);

  const answers = [
    place.area ? { label: t("gettingThere"), body: t("location", { area: place.area }) } : null,
    { label: t("priceAvailability"), body: t("fullPayment") },
    { label: known("cancellation"), body: refund("full") },
    place.houseRules ? { label: known("houseRules"), body: place.houseRules } : null,
  ].filter((answer): answer is { label: string; body: string } => answer !== null);

  return (
    <div className="mx-auto max-w-280 px-4 pt-6 pb-16 sm:px-6 lg:px-10">
      <div className="grid gap-12 lg:grid-cols-[1fr_400px] lg:gap-20">
        <div className="min-w-0">
          <h1 className="font-poster text-[clamp(1.75rem,3vw,2.5rem)]">{t("title", { name: hostName })}</h1>
          {host.response === null || host.response.medianMinutes === null ? null : (
            <p className="mt-2 text-lg text-muted">{meet(responseSpeed(host.response.medianMinutes))}</p>
          )}

          <h2 className="mt-10 text-[1.375rem] font-semibold">{t("mostAsk")}</h2>
          <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {answers.map((answer) => (
              <div key={answer.label}>
                <dt className="text-sm font-semibold text-muted">{answer.label}</dt>
                <dd className="mt-1 whitespace-pre-line">{answer.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6">
            <ArrowLink href={`/p/${place.slug}#booking`}>{t("checkAvailability")}</ArrowLink>
          </p>
        </div>

        <TicketCard
          sticky
          title={t("stillQuestions")}
          intro={takesMessages ? t("stillQuestionsBody", { name: hostName }) : undefined}
          stub={nights ? <p className="text-sm font-semibold">{`${t("yourStay")}: ${nights}`}</p> : undefined}
        >
          {/* acceptsMessages keeps the form open whenever there is no WhatsApp number, so one of them always shows. */}
          <div className="grid gap-6">
            {takesMessages ? (
              <ContactHostForm
                slug={place.slug}
                hostName={hostName}
                stay={
                  stay.checkIn && stay.checkOut
                    ? { checkIn: stay.checkIn, checkOut: stay.checkOut, guests: stay.guests }
                    : undefined
                }
              />
            ) : null}
            {whatsapp ? (
              <div className="grid gap-3">
                {takesMessages ? <p className="text-sm font-semibold">{t("orWhatsapp")}</p> : null}
                <WhatsAppLink phone={whatsapp} label={meet("whatsapp")} />
              </div>
            ) : null}
          </div>
        </TicketCard>
      </div>
    </div>
  );
}
