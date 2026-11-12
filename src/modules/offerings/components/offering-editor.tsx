"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCloseDialog } from "@/components/ui/form-dialog";
import { choiceChipClass, Field, inputClass, LabeledControl, TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { categoryName } from "@/config/appearance";
import {
  ACTIVITY_LEVELS,
  OFFERING_KINDS,
  type OfferingKind,
  PRICE_UNITS,
  SKILL_LEVELS,
} from "@/config/enums";
import { ACCESSIBILITY, LANGUAGES, TAGS } from "@/config/listing";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { RegionSelect } from "@/modules/workspaces";

export interface EditableOffering {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  categorySlug: string | null;
  area: string | null;
  region: string | null;
  meetingPoint: string | null;
  latitude: number | null;
  longitude: number | null;
  durationMinutes: number;
  priceCents: number;
  priceUnit: string;
  maxGuests: number;
  minAge: number | null;
  activityLevel: string | null;
  skillLevel: string | null;
  included: string[];
  notIncluded: string[];
  accessibility: string[];
  languages: string[];
  tags: string[];
  active: boolean;
}

/** The admin's categories for each kind, so an experience is never filed under a service's category. */
export type OfferingCategories = Record<
  OfferingKind,
  Array<{ slug: string; nameEn: string; nameAr: string }>
>;

/** The most lines a list keeps; the server refuses more. */
const MAX_LIST_ITEMS = 12;

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim() || null;
const optionalNumber = (data: FormData, key: string) => {
  const raw = String(data.get(key) ?? "").trim();
  return raw === "" ? null : Number(raw);
};
const lines = (data: FormData, key: string) =>
  String(data.get(key) ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);

/** Adds an experience or service when `offering` is absent, and edits it otherwise. */
export function OfferingEditor({
  businessId,
  offering,
  categories,
}: {
  businessId: string;
  offering?: EditableOffering;
  categories: OfferingCategories;
}) {
  const t = useTranslations("dashboard.offerings");
  const tListing = useTranslations("listing");
  const locale = useLocale();
  const { run, pending, error } = useAction();
  const closeDialog = useCloseDialog();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      kind: data.get("kind"),
      title: text(data, "title"),
      description: text(data, "description"),
      categorySlug: text(data, "categorySlug"),
      area: text(data, "area"),
      region: text(data, "region"),
      meetingPoint: text(data, "meetingPoint"),
      latitude: optionalNumber(data, "latitude"),
      longitude: optionalNumber(data, "longitude"),
      durationMinutes: Number(data.get("durationMinutes")),
      priceCents: Math.round(Number(data.get("price")) * 100),
      priceUnit: data.get("priceUnit"),
      maxGuests: Number(data.get("maxGuests")),
      minAge: optionalNumber(data, "minAge"),
      activityLevel: text(data, "activityLevel"),
      skillLevel: text(data, "skillLevel"),
      included: lines(data, "included"),
      notIncluded: lines(data, "notIncluded"),
      accessibility: data.getAll("accessibility"),
      languages: data.getAll("languages"),
      tags: data.getAll("tags"),
      ...(offering && { active: data.get("active") === "on" }),
    };
    const saved = await run(() =>
      offering
        ? api.patch(`/api/workspaces/${businessId}/offerings/${offering.id}`, body)
        : api.post(`/api/workspaces/${businessId}/offerings`, body),
    );
    if (saved && !offering) {
      form.reset();
      closeDialog();
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4">
      {/* One column that never grows past the card, so the form fits a phone. */}
      <fieldset disabled={pending} className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <LabeledControl label={t("kind")}>
            <select name="kind" defaultValue={offering?.kind ?? "EXPERIENCE"} className={inputClass}>
              {OFFERING_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`kinds.${kind}`)}
                </option>
              ))}
            </select>
          </LabeledControl>
          <Field
            label={t("titleLabel")}
            name="title"
            required
            minLength={3}
            maxLength={100}
            defaultValue={offering?.title}
          />
        </div>
        <TextArea
          label={t("description")}
          name="description"
          maxLength={4000}
          defaultValue={offering?.description ?? ""}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledControl label={t("category")}>
            <select name="categorySlug" defaultValue={offering?.categorySlug ?? ""} className={inputClass}>
              <option value="">{t("none")}</option>
              {OFFERING_KINDS.map((kind) => (
                <optgroup key={kind} label={t(`kinds.${kind}`)}>
                  {categories[kind].map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {categoryName(category, locale)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </LabeledControl>
          <Field label={t("area")} name="area" maxLength={80} defaultValue={offering?.area ?? ""} />
          <RegionSelect defaultValue={offering?.region ?? null} />
          <Field
            label={t("meetingPoint")}
            name="meetingPoint"
            maxLength={200}
            defaultValue={offering?.meetingPoint ?? ""}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            label={t("price")}
            name="price"
            type="number"
            min={0}
            step={1}
            required
            inputMode="decimal"
            defaultValue={offering ? offering.priceCents / 100 : undefined}
          />
          <LabeledControl label={t("priceUnit")}>
            <select
              name="priceUnit"
              defaultValue={offering?.priceUnit ?? "PER_PERSON"}
              className={inputClass}
            >
              {PRICE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {tListing(`priceUnit.${unit}`)}
                </option>
              ))}
            </select>
          </LabeledControl>
          <Field
            label={t("duration")}
            name="durationMinutes"
            type="number"
            min={15}
            max={1440}
            step={15}
            required
            defaultValue={offering?.durationMinutes ?? 120}
          />
          <Field
            label={t("maxGuests")}
            name="maxGuests"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={offering?.maxGuests ?? 10}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field
            label={t("minAge")}
            name="minAge"
            type="number"
            min={0}
            max={99}
            defaultValue={offering?.minAge ?? ""}
          />
          <LabeledControl label={t("activityLevel")}>
            <select name="activityLevel" defaultValue={offering?.activityLevel ?? ""} className={inputClass}>
              <option value="">{t("notSet")}</option>
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {tListing(`activity.${level}`)}
                </option>
              ))}
            </select>
          </LabeledControl>
          <LabeledControl label={t("skillLevel")}>
            <select name="skillLevel" defaultValue={offering?.skillLevel ?? ""} className={inputClass}>
              <option value="">{t("notSet")}</option>
              {SKILL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {tListing(`skill.${level}`)}
                </option>
              ))}
            </select>
          </LabeledControl>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea
            label={t("included")}
            name="included"
            hint={t("listHint")}
            defaultValue={offering?.included.join("\n")}
          />
          <TextArea
            label={t("notIncluded")}
            name="notIncluded"
            hint={t("listHint")}
            defaultValue={offering?.notIncluded.join("\n")}
          />
        </div>

        <Chips
          legend={t("tags")}
          name="tags"
          selected={offering?.tags ?? []}
          options={TAGS.map((tag) => [tag, tListing(`tags.${tag}`)] as const)}
        />
        <Chips
          legend={t("accessibility")}
          name="accessibility"
          selected={offering?.accessibility ?? []}
          options={ACCESSIBILITY.map((key) => [key, tListing(`accessibility.${key}`)] as const)}
        />
        <Chips
          legend={t("languages")}
          name="languages"
          selected={offering?.languages ?? []}
          options={LANGUAGES.map((code) => [code, tListing(`languages.${code}`)] as const)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("latitude")}
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            defaultValue={offering?.latitude ?? ""}
          />
          <Field
            label={t("longitude")}
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            defaultValue={offering?.longitude ?? ""}
          />
        </div>

        {offering ? (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="active"
              defaultChecked={offering.active}
              className="size-4 accent-accent"
            />
            {t("active")}
          </label>
        ) : null}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {offering ? t("save") : t("create")}
        </Button>
        <FormError message={error} />
      </div>
    </form>
  );
}

function Chips({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: ReadonlyArray<readonly [string, string]>;
  selected: string[];
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([value, label]) => (
          <label key={value} className={choiceChipClass}>
            <input
              type="checkbox"
              name={name}
              value={value}
              defaultChecked={selected.includes(value)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
