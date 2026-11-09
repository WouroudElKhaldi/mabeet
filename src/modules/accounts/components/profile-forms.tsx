"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, panelClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

/** Under a form's button: what went wrong, or that it worked. */
function SaveStatus({ saved, error, label }: { saved: boolean; error: string | null; label: string }) {
  if (error) return <FormError message={error} />;
  return saved ? (
    <p role="status" className="text-sm font-semibold text-success">
      {label}
    </p>
  ) : null;
}

/**
 * The signed-in person's own name and phone, in the dashboard and the admin area. The email is how they sign in, so
 * it is shown but not changed here.
 */
export function ProfileForm({ profile }: { profile: { name: string; email: string; phone: string | null } }) {
  const t = useTranslations("profile");
  const { run, pending, error, fieldErrors } = useAction();
  const [saved, setSaved] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaved(false);
    const done = await run(() =>
      api.patch("/api/me/profile", {
        name: String(data.get("name") ?? "").trim(),
        // People type spaces and dashes in phone numbers; the number itself is what is saved.
        phone: String(data.get("phone") ?? "").replace(/[\s-]/g, "") || null,
      }),
    );
    setSaved(done);
  };

  return (
    <form onSubmit={submit} className={`${panelClass} grid gap-5 sm:grid-cols-2`}>
      <h2 className="text-xl font-semibold sm:col-span-2">{t("details")}</h2>
      <Field
        label={t("name")}
        name="name"
        required
        minLength={2}
        maxLength={80}
        autoComplete="name"
        defaultValue={profile.name}
        error={fieldErrors.name ? t("errors.name") : undefined}
      />
      <Field
        label={t("email")}
        name="email"
        type="email"
        value={profile.email}
        readOnly
        disabled
        hint={t("emailHint")}
      />
      <Field
        label={t("phone")}
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="+96171123456"
        defaultValue={profile.phone ?? ""}
        error={fieldErrors.phone ? t("errors.phone") : undefined}
      />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        <SaveStatus saved={saved} error={error} label={t("saved")} />
      </div>
    </form>
  );
}

/** Changing the password, with the current one. The person's other devices are signed out. */
export function PasswordForm() {
  const t = useTranslations("profile");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await authClient.changePassword({
      currentPassword: String(data.get("current")),
      newPassword: String(data.get("next")),
      revokeOtherSessions: true,
    });
    setPending(false);
    if (result.error) {
      setError(result.error.code?.startsWith("PASSWORD_TOO") ? t("passwordRules") : t("passwordWrong"));
      return;
    }
    form.reset();
    setSaved(true);
  };

  return (
    <form onSubmit={submit} className={`${panelClass} grid gap-5 sm:grid-cols-2`}>
      <h2 className="text-xl font-semibold sm:col-span-2">{t("password")}</h2>
      <Field
        label={t("currentPassword")}
        name="current"
        type="password"
        autoComplete="current-password"
        required
      />
      <Field
        label={t("newPassword")}
        name="next"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint={t("passwordRules")}
      />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("changePassword")}
        </Button>
        <SaveStatus saved={saved} error={error} label={t("passwordChanged")} />
      </div>
    </form>
  );
}
