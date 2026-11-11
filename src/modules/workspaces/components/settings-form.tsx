"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCloseDialog, useSubmitLabel } from "@/components/ui/form-dialog";
import { CheckboxChips } from "@/components/ui/checkbox-chips";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Field, inputClass, LabeledControl, panelClass, TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { categoryName } from "@/config/appearance";
import { BOOKING_MODES, CURRENCIES, isOnlineMode } from "@/config/enums";
import { ACCESSIBILITY, TAGS } from "@/config/listing";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { formatDate } from "@/utils/format";
import { toIsoDate } from "@/utils/dates";
import { RegionSelect } from "./region-select";

type BookingMode = (typeof BOOKING_MODES)[number];

/** The parts of what guests read about the place, each edited on its own from a card on "Your place". */
export type PlaceSection = "profile" | "thingsToKnow" | "location" | "stayRules";

/**
 * The parts of how the place runs that the guided setup asks one screen at a time: the numbers guests reach it on,
 * and how guests book and pay. Settings shows them together, in `general`.
 */
type RunningSection = "contact" | "payments";

export interface PlaceSettings {
  name: string;
  area: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  currency: string;
  commissionRateBps: number;
  holdHours: number;
  paymentInstructions: string | null;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string | null;
  bookingMode: BookingMode;
  onlineTermsAcceptedAt: Date | null;
  listedPublicly: boolean;
  categories: string[];
  tags: string[];
  accessibility: string[];
  minGuestAge: number | null;
  latitude: number | null;
  longitude: number | null;
}

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim() || null;
const optionalNumber = (data: FormData, key: string) => {
  const raw = String(data.get(key) ?? "").trim();
  return raw === "" ? null : Number(raw);
};
/** Phone numbers are typed with spaces and dashes; they are saved as one run of digits after the "+". */
const phoneNumber = (data: FormData, key: string) => text(data, key)?.replace(/[\s-]/g, "") ?? null;

/**
 * The place's settings. `general` is how the business runs (Settings): how guests reach it, whether it is listed,
 * currency, answer time, and how guests book and pay; choosing the booking mode is the owner's, after accepting that
 * online payments are always refunded in full. Each place section is one part of what guests read about the place,
 * edited in a pop-up from its card on "Your place": it saves only its own fields, and closes the pop-up once saved.
 * `contact` and `payments` are parts of `general` on their own, for the guided setup, which moves on once saved.
 */
export function SettingsForm({
  businessId,
  part,
  settings,
  categories,
  isOwner,
}: {
  businessId: string;
  part: "general" | PlaceSection | RunningSection;
  settings: PlaceSettings;
  /** The admin's place categories to pick from (the profile section). */
  categories?: Array<{ slug: string; nameEn: string; nameAr: string }>;
  isOwner: boolean;
}) {
  const t = useTranslations("dashboard.settings");
  const tListing = useTranslations("listing");
  const locale = useLocale();
  const { run, pending, error } = useAction();
  const closeDialog = useCloseDialog();
  const submitLabel = useSubmitLabel(t("save"));
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<BookingMode>(settings.bookingMode);
  const [accepted, setAccepted] = useState(false);
  const termsAccepted = settings.onlineTermsAcceptedAt !== null;
  const needsTerms = isOnlineMode(mode) && !termsAccepted;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const place: Record<PlaceSection, Record<string, unknown>> = {
      profile: {
        name: text(data, "name"),
        area: text(data, "area"),
        region: text(data, "region"),
        address: text(data, "address"),
        categories: data.getAll("categories"),
      },
      thingsToKnow: {
        tags: data.getAll("tags"),
        accessibility: data.getAll("accessibility"),
        minGuestAge: optionalNumber(data, "minGuestAge"),
      },
      location: { latitude: optionalNumber(data, "latitude"), longitude: optionalNumber(data, "longitude") },
      stayRules: {
        checkInTime: data.get("checkInTime"),
        checkOutTime: data.get("checkOutTime"),
        houseRules: text(data, "houseRules"),
      },
    };
    const contact = { phone: phoneNumber(data, "phone"), whatsapp: phoneNumber(data, "whatsapp") };
    const payments = {
      paymentInstructions: text(data, "paymentInstructions"),
      // Only an owner chooses how guests book and pay; anyone else saves the rest without touching it.
      ...(isOwner && { bookingMode: mode, ...(accepted && { acceptOnlineTerms: true }) }),
    };
    const body =
      part === "general"
        ? {
            ...contact,
            ...payments,
            listedPublicly: data.get("listedPublicly") === "on",
            currency: data.get("currency"),
            commissionRateBps: Math.round(Number(data.get("commission")) * 100),
            holdHours: Number(data.get("holdHours")),
          }
        : part === "contact"
          ? contact
          : part === "payments"
            ? payments
            : place[part];
    setSaved(false);
    const done = await run(() => api.patch(`/api/workspaces/${businessId}/settings`, body));
    setSaved(done);
    if (done && part !== "general") closeDialog();
  };
  const plain = part !== "general";
  const waitsForTerms = (part === "general" || part === "payments") && needsTerms && !accepted;

  const contactFields = (
    <>
      <Field label={t("phone")} name="phone" type="tel" defaultValue={settings.phone ?? ""} />
      <Field label={t("whatsapp")} name="whatsapp" type="tel" defaultValue={settings.whatsapp ?? ""} />
    </>
  );
  const paymentFields = (
    <>
      <p className="text-sm text-muted sm:col-span-2">{t("payments.intro")}</p>
      <div className="sm:col-span-2">
        <ChoiceCards
          legend={t("payments.bookingMode")}
          name="bookingMode"
          columns={3}
          value={mode}
          onChange={setMode}
          disabled={!isOwner}
          choices={BOOKING_MODES.map((value) => ({
            value,
            title: t(`payments.modes.${value}.name`),
            body: t(`payments.modes.${value}.body`),
          }))}
        />
      </div>
      {isOnlineMode(mode) ? (
        <div className="grid gap-2 rounded-xl bg-surface-2 p-4 text-sm sm:col-span-2">
          <p className="font-semibold">{t("payments.policy.title")}</p>
          <p className="text-muted">{t("payments.policy.body")}</p>
          {termsAccepted && settings.onlineTermsAcceptedAt ? (
            <p className="font-semibold text-success">
              {t("payments.policy.accepted", {
                date: formatDate(toIsoDate(settings.onlineTermsAcceptedAt), locale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              })}
            </p>
          ) : (
            <label className="flex items-start gap-2 font-semibold">
              <input
                type="checkbox"
                checked={accepted}
                disabled={!isOwner}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 size-4 accent-accent"
              />
              {t("payments.policy.accept")}
            </label>
          )}
        </div>
      ) : null}
      {mode === "OFFLINE" ? (
        <div className="sm:col-span-2">
          <TextArea
            label={t("paymentInstructions")}
            name="paymentInstructions"
            maxLength={1000}
            defaultValue={settings.paymentInstructions ?? ""}
            placeholder={t("paymentPlaceholder")}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-6">
      {part !== "general" ? (
        <>
          {part === "profile" && (
            <Group plain title={t("profile")}>
              <Field
                label={t("name")}
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={settings.name}
              />
              <Field label={t("area")} name="area" maxLength={80} defaultValue={settings.area ?? ""} />
              <RegionSelect defaultValue={settings.region} />
              <div className="sm:col-span-2">
                <Field
                  label={t("address")}
                  name="address"
                  maxLength={200}
                  defaultValue={settings.address ?? ""}
                />
              </div>
              {categories && categories.length > 0 ? (
                <CheckboxChips
                  legend={t("categories")}
                  name="categories"
                  options={categories.map((category) => ({
                    value: category.slug,
                    label: categoryName(category, locale),
                  }))}
                  selected={settings.categories}
                />
              ) : null}
            </Group>
          )}

          {part === "thingsToKnow" && (
            <Group plain title={t("thingsToKnow")}>
              <CheckboxChips
                legend={t("tags")}
                hint={t("tagsHint")}
                name="tags"
                options={TAGS.map((tag) => ({ value: tag, label: tListing(`tags.${tag}`) }))}
                selected={settings.tags}
              />
              <CheckboxChips
                legend={t("accessibility")}
                name="accessibility"
                options={ACCESSIBILITY.map((key) => ({
                  value: key,
                  label: tListing(`accessibility.${key}`),
                }))}
                selected={settings.accessibility}
              />
              <Field
                label={t("minGuestAge")}
                name="minGuestAge"
                type="number"
                min={0}
                max={99}
                defaultValue={settings.minGuestAge ?? ""}
                hint={t("minGuestAgeHint")}
              />
            </Group>
          )}

          {part === "location" && (
            <Group plain title={t("location")}>
              <Field
                label={t("latitude")}
                name="latitude"
                type="number"
                step="any"
                min={-90}
                max={90}
                defaultValue={settings.latitude ?? ""}
              />
              <Field
                label={t("longitude")}
                name="longitude"
                type="number"
                step="any"
                min={-180}
                max={180}
                defaultValue={settings.longitude ?? ""}
              />
              <p className="text-sm text-muted sm:col-span-2">{t("locationHint")}</p>
            </Group>
          )}

          {part === "contact" && (
            <Group plain title={t("contact")}>
              {contactFields}
            </Group>
          )}

          {part === "payments" && (
            <Group plain title={t("payments.title")}>
              {paymentFields}
            </Group>
          )}

          {part === "stayRules" && (
            <Group plain title={t("stayRules")}>
              <Field
                label={t("checkInTime")}
                name="checkInTime"
                type="time"
                defaultValue={settings.checkInTime}
              />
              <Field
                label={t("checkOutTime")}
                name="checkOutTime"
                type="time"
                defaultValue={settings.checkOutTime}
              />
              <div className="sm:col-span-2">
                <TextArea
                  label={t("houseRules")}
                  name="houseRules"
                  maxLength={2000}
                  defaultValue={settings.houseRules ?? ""}
                />
              </div>
            </Group>
          )}
        </>
      ) : (
        <>
          <Group title={t("contact")}>
            {contactFields}
            <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
              <input
                type="checkbox"
                name="listedPublicly"
                defaultChecked={settings.listedPublicly}
                className="size-4 accent-accent"
              />
              {t("listedPublicly")}
            </label>
          </Group>

          <Group title={t("payments.title")}>{paymentFields}</Group>

          <Group title={t("bookingRules")}>
            <LabeledControl label={t("currency")}>
              <select name="currency" defaultValue={settings.currency} className={inputClass}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </LabeledControl>
            <Field
              label={t("holdHours")}
              name="holdHours"
              type="number"
              min={1}
              max={168}
              defaultValue={settings.holdHours}
              hint={t("holdHint")}
            />
            <Field
              label={t("commission")}
              name="commission"
              type="number"
              step="0.5"
              min={0}
              max={50}
              defaultValue={settings.commissionRateBps / 100}
              hint={t("commissionHint")}
            />
          </Group>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || waitsForTerms}>
          {submitLabel}
        </Button>
        {waitsForTerms ? <p className="text-sm text-muted">{t("payments.policy.required")}</p> : null}
        {saved && !error && !plain ? (
          <p role="status" className="text-sm font-semibold text-success">
            {t("saved")}
          </p>
        ) : null}
        <FormError message={error} />
      </div>
    </form>
  );
}

/**
 * One titled part of the form, with its fields two to a row from `sm`: a raised card on the Settings page, and `plain`
 * in a pop-up, whose own title already names it (the legend stays for screen readers).
 */
function Group({ title, plain = false, children }: { title: string; plain?: boolean; children: ReactNode }) {
  return (
    <fieldset className={plain ? "grid gap-4 sm:grid-cols-2" : `${panelClass} grid gap-4 sm:grid-cols-2`}>
      <legend
        className={plain ? "sr-only" : "float-start mb-1 font-display text-xl font-semibold sm:col-span-2"}
      >
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
