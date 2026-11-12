"use client";

import type { PartnerKind } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useCloseDialog } from "@/components/ui/form-dialog";
import { Button } from "@/components/ui/button";
import { Field, inputClass, LabeledControl } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { PARTNER_KINDS } from "@/config/partner-kinds";
import { REGION_KEYS } from "@/config/regions";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/** A partner's fields as the editor shows them; a new partner has none yet. */
export interface PartnerFields {
  id: string;
  name: string;
  kind: PartnerKind;
  region: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  phone: string | null;
}

const SHOWN_FIELDS = ["name", "latitude", "longitude", "photoUrl", "websiteUrl", "phone"] as const;

/** An empty box means "none", so the server receives null rather than an empty text it would refuse. */
function text(data: FormData, name: string) {
  const value = String(data.get(name) ?? "").trim();
  return value === "" ? null : value;
}

function coordinate(data: FormData, name: string) {
  const value = text(data, name);
  return value === null ? null : Number(value);
}

/**
 * Adds a partner place, or changes one: every field is sent each time, as the API expects. The map pin is optional;
 * with it (and the guesthouse's), guests see how far the partner is.
 */
export function PartnerForm({ partner }: { partner?: PartnerFields }) {
  const t = useTranslations("admin.partners");
  const kinds = useTranslations("partners.kinds");
  const regions = useTranslations("regions.names");
  const { run, pending, error, fieldErrors } = useAction(SHOWN_FIELDS);
  const closeDialog = useCloseDialog();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: String(data.get("name") ?? ""),
      kind: String(data.get("kind")),
      region: String(data.get("region")),
      area: text(data, "area"),
      latitude: coordinate(data, "latitude"),
      longitude: coordinate(data, "longitude"),
      photoUrl: text(data, "photoUrl"),
      websiteUrl: text(data, "websiteUrl"),
      phone: text(data, "phone"),
    };
    const saved = await run(() =>
      partner ? api.patch(`/api/admin/partners/${partner.id}`, body) : api.post("/api/admin/partners", body),
    );
    if (saved && !partner) {
      form.reset();
      closeDialog();
    }
  };

  const pinError = fieldErrors.latitude || fieldErrors.longitude ? t("errors.pin") : undefined;

  return (
    <form onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          name="name"
          label={t("name")}
          defaultValue={partner?.name}
          required
          minLength={2}
          maxLength={80}
          error={fieldErrors.name ? t("errors.name") : undefined}
        />
        <LabeledControl label={t("kind")}>
          <select name="kind" defaultValue={partner?.kind ?? "RESTAURANT"} className={inputClass}>
            {PARTNER_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kinds(kind)}
              </option>
            ))}
          </select>
        </LabeledControl>
        <LabeledControl label={t("region")}>
          <select name="region" defaultValue={partner?.region ?? REGION_KEYS[0]} className={inputClass}>
            {REGION_KEYS.map((key) => (
              <option key={key} value={key}>
                {regions(key)}
              </option>
            ))}
          </select>
        </LabeledControl>
        <Field name="area" label={t("area")} defaultValue={partner?.area ?? ""} maxLength={80} />
        <Field
          name="latitude"
          type="number"
          step="any"
          min={-90}
          max={90}
          dir="ltr"
          label={t("latitude")}
          hint={t("pinHint")}
          defaultValue={partner?.latitude ?? ""}
          error={pinError}
        />
        <Field
          name="longitude"
          type="number"
          step="any"
          min={-180}
          max={180}
          dir="ltr"
          label={t("longitude")}
          defaultValue={partner?.longitude ?? ""}
          error={pinError}
        />
        <Field
          name="photoUrl"
          type="url"
          label={t("photoUrl")}
          hint={t("linkHint")}
          defaultValue={partner?.photoUrl ?? ""}
          error={fieldErrors.photoUrl ? t("errors.link") : undefined}
        />
        <Field
          name="websiteUrl"
          type="url"
          label={t("websiteUrl")}
          hint={t("socialHint")}
          defaultValue={partner?.websiteUrl ?? ""}
          error={fieldErrors.websiteUrl ? t("errors.link") : undefined}
        />
        <Field
          name="phone"
          type="tel"
          label={t("phone")}
          defaultValue={partner?.phone ?? ""}
          error={fieldErrors.phone ? t("errors.phone") : undefined}
        />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {partner ? t("save") : t("add")}
        </Button>
      </div>
      <FormError message={error} />
    </form>
  );
}
