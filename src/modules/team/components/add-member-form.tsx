"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass, LabeledControl } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import type { RoleChoice } from "./member-controls";

/**
 * Invites someone to the team: their name, email and phone, and the role they will join with. They get an email
 * with the link; `roles` holds only the roles this person may give.
 */
export function AddMemberForm({ businessId, roles }: { businessId: string; roles: RoleChoice[] }) {
  const t = useTranslations("dashboard.team");
  const { run, pending, error, fieldErrors } = useAction(["name", "email", "phone"]);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (roles.length === 0) return <p className="text-sm text-muted">{t("noRoleToGive")}</p>;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email")).trim();
    setSentTo(null);
    const sent = await run(() =>
      api.post(`/api/workspaces/${businessId}/invitations`, {
        name: String(data.get("name")).trim(),
        email,
        // Typed the way people write numbers ("+961 71 123 456"); stored without the spaces.
        phone: String(data.get("phone")).replace(/[\s-]/g, ""),
        roleId: String(data.get("roleId")),
      }),
    );
    if (sent) {
      setSentTo(email);
      form.reset();
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("name")}
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          error={fieldErrors.name ? t("nameError") : null}
        />
        <Field
          label={t("email")}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          error={fieldErrors.email ? t("emailError") : null}
        />
        <Field
          label={t("phone")}
          name="phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="off"
          pattern="\+?[0-9\s\-]{8,18}"
          hint={t("phoneHint")}
          error={fieldErrors.phone ? t("phoneError") : null}
        />
        <LabeledControl label={t("role")}>
          <select name="roleId" required className={inputClass}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </LabeledControl>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          <Send className="size-4" aria-hidden />
          {t("sendInvite")}
        </Button>
        <FormError message={error} />
        {sentTo && (
          <p role="status" className="text-sm font-semibold text-success">
            {t("inviteSent", { email: sentTo })}
          </p>
        )}
      </div>
    </form>
  );
}
