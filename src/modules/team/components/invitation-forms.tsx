"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { api, errorMessage } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { signInUrl } from "@/utils/sign-in-url";

/**
 * Registers from an invitation: the email is the invited one and the role is the host's choice, so only the
 * name, phone and a password are asked. Then it signs in and opens the dashboard of the team they joined.
 */
export function InvitationSignUp({
  token,
  email,
  defaults,
  businessId,
}: {
  token: string;
  email: string;
  defaults: { name: string; phone: string };
  businessId: string;
}) {
  const t = useTranslations("invitation");
  const tAuth = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    setPending(true);
    setError(null);
    try {
      await api.post(`/api/invitations/${token}/register`, {
        name: String(form.get("name")),
        phone: String(form.get("phone")).replace(/[\s-]/g, ""),
        password,
      });
      const signedIn = await authClient.signIn.email({ email, password });
      // A full page load: the dashboard reads the new session on the server. They have joined either way; if
      // signing in failed, the sign-in page brings them to the dashboard.
      const dashboard = `/dashboard/${businessId}`;
      window.location.assign(signedIn.error ? signInUrl(dashboard) : dashboard);
    } catch (caught) {
      setError(errorMessage(caught, t("error")));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="rise-in-sequence grid gap-5 short:gap-4">
      <Field
        label={tAuth("name")}
        name="name"
        required
        minLength={2}
        maxLength={80}
        autoComplete="name"
        defaultValue={defaults.name}
      />
      <Field label={tAuth("email")} name="email" type="email" value={email} readOnly hint={t("emailFixed")} />
      <Field
        label={t("phone")}
        name="phone"
        type="tel"
        required
        inputMode="tel"
        autoComplete="tel"
        pattern="\+?[0-9\s\-]{8,18}"
        defaultValue={defaults.phone}
      />
      <Field
        label={tAuth("password")}
        name="password"
        type="password"
        required
        minLength={10}
        autoComplete="new-password"
        hint={tAuth("passwordHint")}
      />
      <FormError message={error} className="rounded-md bg-danger/10 px-4 py-3" />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {t("join")}
      </Button>
    </form>
  );
}

/** A signed-in person whose email the invitation was sent to joins with one click. */
export function AcceptInvitation({ token, businessId }: { token: string; businessId: string }) {
  const t = useTranslations("invitation");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const accept = async () => {
    setPending(true);
    setError(null);
    try {
      await api.post(`/api/invitations/${token}/accept`, {});
      window.location.assign(`/dashboard/${businessId}`);
    } catch (caught) {
      setError(errorMessage(caught, t("error")));
      setPending(false);
    }
  };

  return (
    <div className="grid gap-4">
      <FormError message={error} className="rounded-md bg-danger/10 px-4 py-3" />
      <Button size="lg" disabled={pending} className="w-full" onClick={() => void accept()}>
        {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {t("join")}
      </Button>
    </div>
  );
}
