"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { authClient } from "@/lib/auth-client";

/** Asks for a reset link. Always answers the same way, so it never reveals which emails have accounts. */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setPending(true);
    setError(null);
    const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    // Refused for too many tries: no link was made, so "it is on its way" would not be true.
    if (result.error?.status === 429) {
      setError(t("tooManyAttempts"));
      return;
    }
    setSentTo(email);
  };

  if (sentTo) {
    return (
      <div role="status" className="grid gap-4 rounded-2xl bg-accent-soft p-6">
        <p className="text-muted">{t("forgot.sent", { email: sentTo })}</p>
        <Link href="/sign-in" className="font-semibold underline underline-offset-4">
          {t("forgot.back")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rise-in-sequence grid gap-5 short:gap-4">
      <Field label={t("email")} name="email" type="email" required autoComplete="email" />
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {t("forgot.submit")}
      </Button>
      <Link href="/sign-in" className="text-center text-sm font-semibold underline underline-offset-4">
        {t("forgot.back")}
      </Link>
    </form>
  );
}

/** Sets the new password from the emailed link (?token=…). Better Auth adds ?error=INVALID_TOKEN on a bad link. */
export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const params = useSearchParams();
  const token = params.get("token");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"form" | "done" | "invalid">(
    !token || params.get("error") ? "invalid" : "form",
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setPending(true);
    setError(null);
    const result = await authClient.resetPassword({
      newPassword: String(new FormData(event.currentTarget).get("password")),
      token,
    });
    setPending(false);
    // Too many tries says to wait; the link itself may still be good.
    if (result.error?.status === 429) {
      setError(t("tooManyAttempts"));
      return;
    }
    setState(result.error ? "invalid" : "done");
  };

  if (state !== "form") {
    return (
      <div role="status" className="grid gap-4 rounded-2xl bg-accent-soft p-6">
        <p className="text-muted">{t(state === "done" ? "reset.done" : "reset.invalid")}</p>
        <Link
          href={state === "done" ? "/sign-in" : "/forgot-password"}
          className="font-semibold underline underline-offset-4"
        >
          {state === "done" ? t("forgot.back") : t("reset.again")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rise-in-sequence grid gap-5 short:gap-4">
      <Field
        label={t("password")}
        name="password"
        type="password"
        required
        minLength={10}
        autoComplete="new-password"
        hint={t("passwordHint")}
      />
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {t("reset.submit")}
      </Button>
    </form>
  );
}
