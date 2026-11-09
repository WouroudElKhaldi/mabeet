"use client";

import { CircleCheck, LoaderCircle, PenLine, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field, TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { CONTACT_TOPICS, type ContactTopic } from "@/config/contact";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/**
 * A message to the Mabeet team: name, email, what it is about, and the message. Once sent, the form gives way to a
 * thank-you that says where the answer will arrive, with a way to write another.
 */
export function ContactForm() {
  const t = useTranslations("contact.form");
  const { run, pending, error, fieldErrors } = useAction(["name", "email", "message"]);
  const [topic, setTopic] = useState<ContactTopic>("booking");
  const [sentTo, setSentTo] = useState<{ name: string; email: string } | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const message = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      topic,
      message: String(data.get("message") ?? ""),
    };
    if (await run(() => api.post("/api/public/contact", message))) setSentTo(message);
  };

  if (sentTo) {
    return (
      <div role="status" className="rise-in-sequence grid justify-items-start gap-3">
        <CircleCheck className="size-10 text-success" aria-hidden strokeWidth={1.6} />
        <p className="text-lg font-semibold">{t("sentTitle")}</p>
        <p className="text-sm text-muted">{t("sentBody", sentTo)}</p>
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
        error={fieldErrors.email ? t("errors.email") : undefined}
      />
      <ChoiceChips
        legend={t("topic")}
        name="topic"
        value={topic}
        onChange={setTopic}
        disabled={pending}
        choices={CONTACT_TOPICS.map((value) => ({ value, label: t(`topics.${value}`) }))}
      />
      <TextArea
        label={t("message")}
        name="message"
        required
        minLength={10}
        maxLength={2000}
        rows={5}
        hint={t("messageHint")}
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
