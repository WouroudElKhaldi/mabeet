"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { GuestCounter } from "@/components/ui/guest-counter";
import { useRedirectAction } from "@/hooks/use-redirect-action";
import { api } from "@/lib/api-client";
import { phone as phoneCheck } from "@/lib/schemas";
import { clampGuests } from "@/utils/guest-count";
import { normalizePhone } from "@/utils/phone";

interface GuestDetailsFormProps {
  slug: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  capacity: number;
  /** Where the host's request ends up: the online modes pay at once, the offline mode waits for the host. */
  online: boolean;
  /** What the account already knows, so a signed-in guest types less. */
  defaults: { name: string; email: string; guests: number };
}

type FieldName = "name" | "phone" | "email";

/**
 * The guest's name, mobile number and a note, then the booking. The number is tidied into the international form the
 * booking needs ("71 123 456" becomes +96171123456) before it is sent, and what is wrong is shown under the field, in
 * the guest's language, before anything is sent.
 */
export function GuestDetailsForm({
  slug,
  roomId,
  checkIn,
  checkOut,
  capacity,
  online,
  defaults,
}: GuestDetailsFormProps) {
  const t = useTranslations("bookPage");
  const { run, pending, error } = useRedirectAction();
  const [guests, setGuests] = useState(clampGuests(defaults.guests, 1, capacity));
  const [problems, setProblems] = useState<Partial<Record<FieldName, string>>>({});

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const name = text("name");
    const guestPhone = normalizePhone(text("phone"));
    const email = text("email");
    const note = text("note");

    const found: Partial<Record<FieldName, string>> = {};
    if (name.length < 2) found.name = t("invalidName");
    if (!phoneCheck.safeParse(guestPhone).success) found.phone = t("invalidPhone");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = t("invalidEmail");
    setProblems(found);
    if (Object.keys(found).length > 0) return;

    void run(async () => {
      const booking = await api.post<{ publicToken: string }>(
        `/api/public/places/${encodeURIComponent(slug)}/bookings`,
        {
          roomId,
          checkIn,
          checkOut,
          guestCount: clampGuests(guests, 1, capacity),
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
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field
        label={t("name")}
        name="name"
        defaultValue={defaults.name}
        autoComplete="name"
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
        defaultValue={defaults.email}
        autoComplete="email"
        hint={t("emailHint")}
        error={problems.email}
      />
      <GuestCounter value={guests} onChange={setGuests} max={capacity} />
      <TextArea label={t("note")} name="note" maxLength={1000} placeholder={t("notePlaceholder")} />
      {Object.keys(problems).length > 0 ? <FormError message={t("checkFields")} /> : null}
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined}>
        {online ? t("submitPay") : t("submit")}
      </Button>
    </form>
  );
}
