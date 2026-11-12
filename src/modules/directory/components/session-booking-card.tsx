"use client";

import clsx from "clsx";
import { ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { GuestCounter } from "@/components/ui/guest-counter";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import type { Locale } from "@/config/appearance";
import { useRedirectAction } from "@/hooks/use-redirect-action";
import { api } from "@/lib/api-client";
import { phone as phoneCheck } from "@/lib/schemas";
import { clampGuests } from "@/utils/guest-count";
import { formatMoney, formatSessionTime } from "@/utils/format";
import { normalizePhone } from "@/utils/phone";
import type { OpenSession, PublicOffering } from "../types";

/** The days shown in the card; the rest open in a sheet, so a long schedule never makes the card endless. */
const FIRST_DAYS_SHOWN = 6;

type FieldName = "name" | "phone" | "email";

/**
 * Pick a session, the number of guests and your details; the request holds the seats at once and leads to the
 * booking's own page, where the guest pays (modes 1 and 2) or waits for the host (mode 3). A signed-out visitor is
 * sent to sign in first: booking needs an account.
 */
export function SessionBookingCard({
  offering,
  online,
  defaults,
  signInHref,
}: {
  offering: Pick<PublicOffering, "slug" | "priceCents" | "priceUnit" | "maxGuests" | "sessions"> & {
    currency: string;
    timezone: string;
  };
  online: boolean;
  defaults: { name: string; email: string };
  /** Where a signed-out visitor signs in; null once signed in. */
  signInHref: string | null;
}) {
  const t = useTranslations("offeringPage");
  const tOffer = useTranslations("offering");
  const tBook = useTranslations("bookPage");
  const locale = useLocale() as Locale;
  const { run, pending, error } = useRedirectAction();
  const [sessionId, setSessionId] = useState(
    offering.sessions.find((session) => session.seatsLeft > 0)?.id ?? null,
  );
  const [guests, setGuests] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [problems, setProblems] = useState<Partial<Record<FieldName, string>>>({});

  const money = (cents: number) => formatMoney(cents, offering.currency, locale);
  const selected = offering.sessions.find((session) => session.id === sessionId) ?? null;
  const maxGuests = Math.max(1, Math.min(offering.maxGuests, selected?.seatsLeft ?? offering.maxGuests));
  const seats = clampGuests(guests, 1, maxGuests);
  const total = offering.priceUnit === "PER_PERSON" ? offering.priceCents * seats : offering.priceCents;

  // Sessions grouped by their day where the place is, so "Saturday" means the guest's Saturday at the meeting point.
  const days = useMemo(() => {
    const groups = new Map<string, OpenSession[]>();
    for (const session of offering.sessions) {
      const day = formatSessionTime(session.startsAt, locale, offering.timezone, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      groups.set(day, [...(groups.get(day) ?? []), session]);
    }
    return [...groups.entries()];
  }, [offering.sessions, offering.timezone, locale]);
  // The first days, plus the day of a time picked in the sheet, so the choice stays in view.
  const shownDays = days.filter(
    ([, sessions], index) => index < FIRST_DAYS_SHOWN || sessions.some((session) => session.id === sessionId),
  );

  const dayList = (list: typeof days, picked?: () => void) =>
    list.map(([day, sessions]) => (
      <div key={day} className="grid gap-2">
        <p className="text-xs font-semibold text-muted">{day}</p>
        <div className="flex flex-wrap gap-2">
          {sessions.map((session) => {
            const full = session.seatsLeft <= 0;
            const active = session.id === sessionId;
            return (
              <button
                key={session.id}
                type="button"
                disabled={full}
                aria-pressed={active}
                onClick={() => {
                  setSessionId(session.id);
                  picked?.();
                }}
                className={clsx(
                  "grid rounded-lg px-3.5 py-2 text-start ring-1 transition-shadow",
                  active ? "ring-2 ring-ink" : "ring-line-strong hover:ring-ink",
                  full && "cursor-not-allowed opacity-40",
                )}
              >
                <span className="text-sm font-semibold">
                  {formatSessionTime(session.startsAt, locale, offering.timezone, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-xs text-muted">{t("seatsLeft", { count: session.seatsLeft })}</span>
              </button>
            );
          })}
        </div>
      </div>
    ));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const name = text("name");
    const guestPhone = normalizePhone(text("phone"));
    const email = text("email");
    const note = text("note");

    const found: Partial<Record<FieldName, string>> = {};
    if (name.length < 2) found.name = tBook("invalidName");
    if (!phoneCheck.safeParse(guestPhone).success) found.phone = tBook("invalidPhone");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = tBook("invalidEmail");
    setProblems(found);
    if (Object.keys(found).length > 0) return;

    void run(async () => {
      const booking = await api.post<{ publicToken: string }>(
        `/api/public/experiences/${encodeURIComponent(offering.slug)}/bookings`,
        {
          sessionId: selected.id,
          seats,
          guestName: name,
          guestPhone,
          ...(email ? { guestEmail: email } : {}),
          ...(note ? { guestNote: note } : {}),
        },
      );
      return { url: `/b/${booking.publicToken}` };
    });
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-5 rounded-xl bg-surface p-6 shadow-lift ring-1 ring-line-strong"
    >
      <p className="text-[1.375rem]">
        <span className="font-semibold">{money(offering.priceCents)}</span>{" "}
        <span className="text-base text-muted">
          {offering.priceUnit === "PER_PERSON" ? tOffer("perPerson") : tOffer("perGroup")}
        </span>
      </p>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold">{t("chooseTime")}</legend>
        {days.length === 0 ? <p className="text-sm text-muted">{t("noSessions")}</p> : null}
        {dayList(shownDays)}
        {days.length > FIRST_DAYS_SHOWN ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="justify-self-start text-sm font-semibold underline underline-offset-4"
          >
            {t("showMore", { count: days.length - FIRST_DAYS_SHOWN })}
          </button>
        ) : null}
        <SheetDialog open={showAll} onClose={() => setShowAll(false)} title={t("chooseTime")}>
          <div className="grid gap-5 p-5">{dayList(days, () => setShowAll(false))}</div>
        </SheetDialog>
      </fieldset>

      {selected && !signInHref ? (
        <>
          <div className="rounded-lg px-4 py-3 ring-1 ring-line-strong">
            <GuestCounter value={seats} onChange={setGuests} max={maxGuests} />
          </div>
          <p className="flex justify-between rounded-md bg-accent-soft px-3 py-2 font-semibold">
            <span>{t("total")}</span>
            <span className="tabular-nums">{money(total)}</span>
          </p>
          <fieldset className="grid gap-4 border-t border-line pt-4">
            <legend className="sr-only">{t("yourDetails")}</legend>
            <Field
              label={t("name")}
              name="name"
              autoComplete="name"
              defaultValue={defaults.name}
              error={problems.name}
            />
            <Field
              label={t("phone")}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+961 71 123 456"
              hint={t("phoneHint")}
              error={problems.phone}
            />
            <Field
              label={t("email")}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={defaults.email}
              hint={t("emailHint")}
              error={problems.email}
            />
            <TextArea label={t("note")} name="note" maxLength={1000} />
          </fieldset>
        </>
      ) : null}

      {Object.keys(problems).length > 0 ? <FormError message={tBook("checkFields")} /> : null}
      <FormError message={error} />
      {signInHref ? (
        <ButtonLink href={signInHref} size="lg">
          {t("signInToBook")}
        </ButtonLink>
      ) : (
        <Button type="submit" size="lg" disabled={!selected || pending} aria-busy={pending || undefined}>
          {online ? t("bookNow") : t("request")}
        </Button>
      )}
      <p className="flex items-start justify-center gap-2 text-center text-sm text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {online ? t("payOnlineNote") : t("noChargeYet")}
      </p>
    </form>
  );
}
