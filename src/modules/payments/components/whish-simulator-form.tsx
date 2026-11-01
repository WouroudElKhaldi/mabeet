"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api-client";

/** Phone and one-time code, like Whish's page. Sandbox values: 96170123456 and 111111. */
export function WhishSimulatorForm({ code, cancelUrl }: { code: string; cancelUrl: string }) {
  const t = useTranslations("whishSim");
  const tCommon = useTranslations("common");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      setMessage(null);
      try {
        const result = await api.post<{ ok: boolean; redirect: string | null }>(
          `/api/whish-simulator/pay/${code}`,
          { phone: String(data.get("phone")), otp: String(data.get("otp")) },
        );
        if (result.ok && result.redirect) {
          setMessage({ ok: true, text: t("done") });
          window.location.assign(result.redirect);
        } else {
          setMessage({ ok: false, text: t("wrongCode") });
        }
      } catch (caught) {
        setMessage({ ok: false, text: errorMessage(caught, tCommon("error")) });
      }
    });
  };

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4">
      <Field
        label={t("phone")}
        name="phone"
        type="tel"
        inputMode="numeric"
        defaultValue="96170123456"
        required
      />
      <Field
        label={t("otp")}
        name="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        required
      />
      <Button type="submit" size="lg" disabled={pending}>
        {t("confirm")}
      </Button>
      <a href={cancelUrl} className={buttonClass({ variant: "ghost" })}>
        {t("cancel")}
      </a>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-sm font-semibold text-success" : "text-sm font-semibold text-danger"}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
