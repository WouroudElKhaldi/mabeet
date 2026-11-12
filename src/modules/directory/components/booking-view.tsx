import type { BookingMode, BookingStatus } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import { BoardingPass } from "@/components/brand/boarding-pass";
import { Postmark } from "@/components/brand/postmark";
import { Section } from "@/components/site/section";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { ButtonLink } from "@/components/ui/button";
import { panelClass } from "@/components/ui/field";
import { StepTrail } from "@/components/ui/step-trail";
import type { Locale } from "@/config/appearance";
import type { OnlinePaymentMethod } from "@/config/enums";
import { isOnlineMode } from "@/config/enums";
import { PhoneAlerts } from "@/modules/notifications";
import { NearbyPartners, type NearbyPartner } from "@/modules/partners";
import { PayOnline } from "@/modules/payments";
import { toIsoDate, todayUtc } from "@/utils/dates";
import { formatMoney, formatSessionTime, formatStayDates } from "@/utils/format";
import { todayIn } from "@/utils/zoned-time";
import { bookingProgress, canGuestCancel, watchEverySeconds } from "../booking-progress";
import { BookingWatcher } from "./booking-watcher";
import { GuestCancelButton } from "./guest-cancel-button";
import { HoldCountdown } from "./hold-countdown";

/** What a stay and seats in a session share on the guest's page: where it stands, its place and its payments. */
interface BookingBasics {
  status: BookingStatus;
  bookingMode: BookingMode;
  currency: string;
  totalCents: number;
  guestName: string;
  reference: string;
  holdExpiresAt: Date | null;
  business: {
    name: string;
    slug: string;
    area: string | null;
    whatsapp: string | null;
    phone: string | null;
    paymentInstructions: string | null;
  };
  payments: { status: "PENDING" | "PAID" | "REFUNDED" | "FAILED"; amountCents: number }[];
}

/** A stay as its guest's page shows it. */
export interface GuestBooking extends BookingBasics {
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  room: { name: string };
  business: BookingBasics["business"] & { checkInTime: string };
}

/** Seats in a session of an experience or service, as their guest's page shows them. */
export interface GuestSeats extends BookingBasics {
  seats: number;
  offering: { slug: string; title: string; meetingPoint: string | null };
  session: { startsAt: Date };
  /** The session's day and time are read where the place is. */
  business: BookingBasics["business"] & { timezone: string };
}

/** What differs between a stay and seats: the pass's lines, the day it can be cancelled before, and "book again". */
async function describe(booking: GuestBooking | GuestSeats, locale: Locale, now: Date) {
  const t = await getTranslations("confirmation");
  if ("seats" in booking) {
    const { timezone } = booking.business;
    return {
      kind: "seats" as const,
      title: booking.offering.title,
      firstDay: todayIn(timezone, booking.session.startsAt),
      today: todayIn(timezone, now),
      againHref: `/o/${encodeURIComponent(booking.offering.slug)}`,
      fields: [
        { label: t("when"), value: formatSessionTime(booking.session.startsAt, locale, timezone) },
        { label: t("guestsLabel"), value: t("guests", { count: booking.seats }) },
        { label: t("passenger"), value: booking.guestName },
        ...(booking.offering.meetingPoint
          ? [{ label: t("meetingPoint"), value: booking.offering.meetingPoint }]
          : []),
        { label: t("host"), value: booking.business.name },
      ],
    };
  }
  return {
    kind: "stay" as const,
    title: booking.business.name,
    firstDay: toIsoDate(booking.checkIn),
    today: toIsoDate(todayUtc(now)),
    againHref: `/p/${encodeURIComponent(booking.business.slug)}`,
    fields: [
      { label: t("dates"), value: formatStayDates(booking.checkIn, booking.checkOut, locale) },
      { label: t("room"), value: booking.room.name },
      { label: t("guestsLabel"), value: t("guests", { count: booking.guestCount }) },
      { label: t("passenger"), value: booking.guestName },
      { label: t("checkInFrom"), value: booking.business.checkInTime },
    ],
  };
}

/**
 * The guest's own booking, a stay or seats in a session: where it stands, what to do next (pay, wait for the host), how to reach the host, and how
 * to cancel. While the booking is alive it also offers phone alerts, so the guest hears the host's answer without
 * keeping the page open, and what is worth doing near the stay. `now` is the moment the page is drawn, so the
 * countdown starts from the server's clock.
 */
export async function BookingView({
  token,
  booking,
  methods,
  nearby,
  pushKey,
  now = new Date(),
}: {
  token: string;
  booking: GuestBooking | GuestSeats;
  /** The ways this booking's currency can be paid online, for the pay buttons. */
  methods: OnlinePaymentMethod[];
  /** What is worth doing near the place, for "Near your stay". */
  nearby: NearbyPartner[];
  /** The server's push key, or null when phone alerts are not set up. */
  pushKey: string | null;
  now?: Date;
}) {
  const [t, locale, near] = await Promise.all([
    getTranslations("confirmation"),
    getLocale(),
    getTranslations("partners.nearby"),
  ]);
  const summary = await describe(booking, locale as Locale, now);
  const place = summary.title;
  const money = (cents: number) => formatMoney(cents, booking.currency, locale as Locale);
  const online = isOnlineMode(booking.bookingMode);
  const progress = bookingProgress(booking.bookingMode, booking.status);
  const remainingSeconds = booking.holdExpiresAt
    ? Math.max(0, Math.floor((booking.holdExpiresAt.getTime() - now.getTime()) / 1000))
    : null;
  const paid = booking.payments.filter((payment) => payment.status === "PAID");
  const refunded = booking.payments.filter((payment) => payment.status === "REFUNDED");
  const refundedCents = refunded.reduce((sum, payment) => sum + payment.amountCents, 0);
  const ended =
    booking.status === "DECLINED" || booking.status === "EXPIRED" || booking.status === "CANCELLED";
  const contact = booking.business.whatsapp || booking.business.phone;

  return (
    <div className="mx-auto grid max-w-280 gap-12 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-10">
      <BookingWatcher everySeconds={watchEverySeconds(booking.bookingMode, booking.status)} />
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h1 className="font-poster text-[clamp(1.75rem,3.2vw,2.25rem)]">
            {t(`${summary.kind === "seats" ? "seatHeading" : "heading"}.${booking.status}`, { place })}
          </h1>
          {progress ? (
            <StepTrail
              label={t("title")}
              steps={progress.steps.map((step) => t(`steps.${step}`))}
              current={progress.current}
            />
          ) : null}
        </div>

        {booking.status === "AWAITING_PAYMENT" ? (
          <section className={`${panelClass} flex flex-col gap-4`}>
            <h2 className="text-xl font-semibold">{t("pay.title", { amount: money(booking.totalCents) })}</h2>
            <p className="text-muted">
              {t(summary.kind === "seats" ? "pay.seatIntro" : "pay.intro")}{" "}
              {remainingSeconds !== null ? <HoldCountdown remainingSeconds={remainingSeconds} /> : null}
            </p>
            <PayOnline token={token} methods={methods} />
          </section>
        ) : null}

        {booking.status === "HELD" ? (
          <section className={`${panelClass} flex flex-col gap-3`}>
            {paid.length > 0 ? (
              <p className="font-semibold">{t("pay.paid", { amount: money(booking.totalCents) })}</p>
            ) : null}
            <p className="text-muted">
              {t(summary.kind === "seats" ? "seatHoldIntro" : "holdIntro")}{" "}
              {remainingSeconds !== null ? <HoldCountdown remainingSeconds={remainingSeconds} /> : null}
            </p>
          </section>
        ) : null}

        {!online && (booking.status === "HELD" || booking.status === "CONFIRMED") ? (
          <section className={`${panelClass} flex flex-col gap-2`}>
            <h2 className="text-xl font-semibold">{t("payTitle", { amount: money(booking.totalCents) })}</h2>
            <p className="whitespace-pre-line text-muted">
              {booking.business.paymentInstructions || t("payFallback")}
            </p>
          </section>
        ) : null}

        {online && booking.status === "CONFIRMED" ? (
          <p className="font-semibold">{t("pay.paid", { amount: money(booking.totalCents) })}</p>
        ) : null}

        {ended ? (
          <section className="flex flex-col items-start gap-3">
            {refundedCents > 0 ? (
              <p className="font-semibold">{t("pay.refunded", { amount: money(refundedCents) })}</p>
            ) : online && paid.length > 0 ? (
              <p className="font-semibold">{t("refundNote")}</p>
            ) : null}
            <ButtonLink href={summary.againHref}>{t("bookAgain")}</ButtonLink>
          </section>
        ) : null}

        {contact ? <WhatsAppLink phone={contact} label={t("whatsapp")} /> : null}

        {canGuestCancel(booking.status, summary.firstDay, summary.today) ? (
          <GuestCancelButton token={token} online={online} />
        ) : null}

        <p className="text-sm text-muted">{t("keepLink")}</p>

        {!ended && pushKey ? <PhoneAlerts publicKey={pushKey} forBooking /> : null}

        {!ended && nearby.length > 0 ? (
          <Section id="nearby" title={near("title")} intro={near("intro")}>
            <NearbyPartners partners={nearby} />
          </Section>
        ) : null}
      </div>

      <aside className="relative lg:sticky lg:top-28 lg:self-start">
        <BoardingPass
          kicker={t(`status.${booking.status}`)}
          title={place}
          subtitle={booking.business.area}
          fields={summary.fields}
          stub={
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-muted">
                  {t("reference")} {booking.reference}
                </p>
                <p className="mt-1 flex gap-3 text-lg font-semibold">
                  <span>{t("total")}</span>
                  <span className="tabular-nums">{money(booking.totalCents)}</span>
                </p>
              </div>
              {booking.status === "CONFIRMED" ? <Postmark className="size-16 shrink-0" spin /> : null}
            </div>
          }
        />
      </aside>
    </div>
  );
}
