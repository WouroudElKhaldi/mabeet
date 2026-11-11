"use client";

import { CircleCheck, LoaderCircle, PenLine, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/**
 * A guest's question to the host: their name, the email the host replies to, and the question. The stay they were
 * looking at travels with it, so the host answers about the right nights. Once sent, the form gives way to a
 * thank-you that says where the answer will arrive, with a way to ask something else.
 */
export function ContactHostForm({
  slug,
  hostName,
  stay,
}: {
  slug: string;
  /** Who the guest is writing to, for the placeholder and the thank-you. */
  hostName: string;
  /** The nights and guests the address carried, sent with the question when they are there. */
  stay?: { checkIn: string; checkOut: string; guests?: number };
}) {
  const t = useTranslations("contactHost");
  const { run, pending, error, fieldErrors } = useAction(["name", "email", "message"]);
  const [sentTo, setSentTo] = useState<{ email: string } | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const question = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      message: String(data.get("message") ?? ""),
      ...stay,
    };
    if (await run(() => api.post(`/api/public/places/${slug}/messages`, question))) {
      setSentTo({ email: question.email });
    }
  };

  if (sentTo) {
    return (
      <div role="status" className="rise-in-sequence grid justify-items-start gap-3">
        <CircleCheck className="size-10 text-success" aria-hidden strokeWidth={1.6} />
        <p className="text-lg font-semibold">{t("sentTitle")}</p>
        <p className="text-sm text-muted">{t("sentBody", { name: hostName })}</p>
        <Button variant="secondary" className={`mt-2 ${slideParent}`} onClick={() => setSentTo(null)}>
          <SlideLabel icon={PenLine}>{t("another")}</SlideLabel>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rise-in-sequence grid gap-5" noValidate>
      <Field
        label={t("name")}
        name="name"
        autoComplete="name"
        required
        minLength={2}
        maxLength={80}
        error={fieldErrors.name ? t("errors.name") : undefined}
      />
      <Field
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        hint={t("emailHint")}
        error={fieldErrors.email ? t("errors.email") : undefined}
      />
      <TextArea
        label={t("message")}
        name="message"
        required
        minLength={10}
        maxLength={2000}
        rows={5}
        placeholder={t("placeholder", { name: hostName })}
        error={fieldErrors.message ? t("errors.message") : undefined}
      />
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending} className={`w-full ${slideParent}`}>
        <SlideLabel icon={pending ? LoaderCircle : Send} spinning={pending} flipInRtl={!pending}>
          {pending ? t("sending") : t("send")}
        </SlideLabel>
      </Button>
    </form>
  );
}
