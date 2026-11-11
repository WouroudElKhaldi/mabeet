"use client";

import type { HostContact } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxChips } from "@/components/ui/checkbox-chips";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field, panelClass, TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { HOST_CONTACT_OPTIONS } from "@/config/enums";
import { LANGUAGES } from "@/config/listing";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

interface HostProfile {
  displayName: string | null;
  bio: string | null;
  city: string | null;
  languages: string[];
  hostingSince: number | null;
  showOnListings: boolean;
  contactBy: HostContact;
}

/**
 * The owner's own host profile, shared by all their places. It is always saved; guests see it only while "Show my
 * profile on my listings" is on. There is no phone or WhatsApp field: guests use the business's own numbers.
 */
export function HostProfileForm({
  businessId,
  profile,
}: {
  businessId: string;
  profile: HostProfile | null;
}) {
  const t = useTranslations("hostProfile");
  const tLanguages = useTranslations("listing.languages");
  const { run, pending, error } = useAction();
  const [contactBy, setContactBy] = useState<HostContact>(profile?.contactBy ?? "BOTH");
  const [saved, setSaved] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim() || null;
    const since = text("hostingSince");
    setSaved(false);
    const done = await run(() =>
      api.put(`/api/workspaces/${businessId}/host-profile`, {
        displayName: text("displayName"),
        bio: text("bio"),
        city: text("city"),
        languages: data.getAll("languages"),
        hostingSince: since ? Number(since) : null,
        showOnListings: data.get("showOnListings") === "on",
        contactBy,
      }),
    );
    setSaved(done);
  };

  return (
    <form onSubmit={submit} className={`${panelClass} grid gap-5 sm:grid-cols-2`}>
      <Field
        label={t("displayName")}
        name="displayName"
        maxLength={80}
        defaultValue={profile?.displayName ?? ""}
        hint={t("displayNameHint")}
      />
      <Field label={t("city")} name="city" maxLength={80} defaultValue={profile?.city ?? ""} />
      <Field
        label={t("hostingSince")}
        name="hostingSince"
        type="number"
        inputMode="numeric"
        min={1950}
        max={2100}
        defaultValue={profile?.hostingSince ?? ""}
      />
      <CheckboxChips
        legend={t("languages")}
        name="languages"
        options={LANGUAGES.map((code) => ({ value: code, label: tLanguages(code) }))}
        selected={profile?.languages ?? []}
      />
      <div className="sm:col-span-2">
        <TextArea
          label={t("bio")}
          name="bio"
          maxLength={1500}
          defaultValue={profile?.bio ?? ""}
          placeholder={t("bioPlaceholder")}
        />
      </div>
      <label className="flex items-start gap-3 rounded-lg bg-surface-2 p-4 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="showOnListings"
          defaultChecked={profile?.showOnListings ?? false}
          className="mt-0.5 size-4 accent-accent"
        />
        <span>
          <span className="block font-semibold">{t("show")}</span>
          <span className="block text-muted">{t("showHint")}</span>
        </span>
      </label>
      <div className="grid gap-1 sm:col-span-2">
        <ChoiceChips
          legend={t("contactBy")}
          name="contactBy"
          choices={HOST_CONTACT_OPTIONS.map((option) => ({ value: option, label: t(`contact.${option}`) }))}
          value={contactBy}
          onChange={setContactBy}
        />
        <p className="text-sm text-muted">{t("contactByHint")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {saved && (
          <p role="status" className="text-sm font-semibold text-success">
            {t("saved")}
          </p>
        )}
      </div>
      <FormError message={error} />
    </form>
  );
}
