import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";
import { ButtonLink } from "@/components/ui/button";
import type { Locale } from "@/config/appearance";
import { MAX_STAY_NIGHTS } from "@/config/booking-limits";
import { isOnlineMode } from "@/config/enums";
import { placeParams } from "@/modules/bookings";
import { GuestDetailsForm, initialStay, StaySummary } from "@/modules/directory";
import { getPlace, getRoomAvailability, quoteRoom } from "@/modules/directory/server";
import { requirePageUser } from "@/server/http/session";
import { toDateRange } from "@/utils/dates";
import { formatMoney } from "@/utils/format";
import { clampGuests } from "@/utils/guest-count";

const loadPlace = cache(getPlace);

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bookPage");
  return { title: t("title") };
}

// The stay as the guest arrived with it, kept in the address when they go back to choose, or on to sign in.
function carriedQuery(query: Record<string, string | string[] | undefined>) {
  const carried = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (typeof value === "string") carried.set(key, value);
  const text = carried.toString();
  return text ? `?${text}` : "";
}

/**
 * Where a guest checks the stay and enters their details. The stay comes in the address from the place page; anything
 * missing or wrong sends the guest back there to choose, and a stay that cannot be booked says why instead of
 * showing a form that would fail.
 */
export default async function BookPage({ params, searchParams }: PageProps) {
  const { slug } = placeParams.parse(await params);
  const query = await searchParams;
  const carried = carriedQuery(query);
  // Booking needs an account: a signed-out guest signs in, then comes straight back here with the stay.
  const user = await requirePageUser(`/p/${encodeURIComponent(slug)}/book${carried}`);
  const place = await loadPlace(slug);
  if (!place) notFound();

  const stay = initialStay(query);
  const unit = place.units.find((candidate) => candidate.id === stay.roomId);
  const back = `/p/${encodeURIComponent(slug)}${carried}`;
  if (!unit || !stay.checkIn || !stay.checkOut) redirect(back);

  const guests = clampGuests(stay.guests ?? 2, 1, unit.capacity);
  const range = toDateRange({ checkIn: stay.checkIn, checkOut: stay.checkOut });
  const [quote, availability, t, booking, locale] = await Promise.all([
    quoteRoom(slug, unit.id, { range, guests }),
    getRoomAvailability(slug, unit.id, range),
    getTranslations("bookPage"),
    getTranslations("booking"),
    getLocale(),
  ]);

  const problem = quote.issue
    ? {
        PAST: booking("issues.PAST"),
        TOO_FAR: booking("issues.TOO_FAR"),
        TOO_LONG: booking("issues.TOO_LONG", { max: MAX_STAY_NIGHTS }),
        MIN_NIGHTS: booking("issues.MIN_NIGHTS", { count: unit.minNights }),
        CAPACITY: booking("issues.CAPACITY", { count: unit.capacity }),
      }[quote.issue]
    : availability.takenNights.length > 0
      ? t("taken")
      : null;

  const online = isOnlineMode(place.bookingMode);
  const amount = formatMoney(quote.totalCents, quote.currency, locale as Locale);

  return (
    <div className="mx-auto grid max-w-280 gap-12 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-10">
      <div className="min-w-0">
        <h1 className="font-poster text-[clamp(1.75rem,3.2vw,2.25rem)]">{t("title")}</h1>
        {problem ? (
          <div role="alert" className="mt-6 flex flex-col items-start gap-4 rounded-xl bg-surface-2 p-5">
            <p className="font-semibold">{problem}</p>
            <ButtonLink href={back} variant="secondary">
              {t("pickOther")}
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            <GuestDetailsForm
              slug={slug}
              roomId={unit.id}
              checkIn={stay.checkIn}
              checkOut={stay.checkOut}
              capacity={unit.capacity}
              online={online}
              defaults={{ name: user.name, email: user.email, guests }}
            />
            <div className="flex flex-col gap-2 text-sm text-muted">
              <p>{online ? t("termsPay") : t("terms")}</p>
              {online ? (
                <p>{t.rich("payOnlineNote", { amount, strong: (chunks) => <strong>{chunks}</strong> })}</p>
              ) : (
                <p>{t.rich("payHostNote", { amount, strong: (chunks) => <strong>{chunks}</strong> })}</p>
              )}
              {place.bookingMode === "ONLINE_APPROVAL" ? (
                <p>{t("approvalNote", { hours: place.holdHours })}</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <StaySummary
          place={place}
          roomName={unit.name}
          checkIn={stay.checkIn}
          checkOut={stay.checkOut}
          quote={quote}
        />
      </aside>
    </div>
  );
}
