"use client";

import type { OfferKind } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { choiceChipClass, inputClass, labelledControlClass } from "@/components/ui/field";
import { FormDialog, useCloseDialog } from "@/components/ui/form-dialog";
import { FormError } from "@/components/ui/form-error";
import { MAX_OFFER_FIRST_MONTHS, OFFER_KINDS, PAID_PLANS } from "@/config/plans";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

// Platform admins give hosts a plan free, or a share off it: for every place or one host's place, during each place's
// first months or between two dates. The admin's table lists the offers; making one opens this form in a pop-up, and
// ending one stops it now while keeping what it already gave.

const TIMINGS = ["firstMonths", "dates"] as const;
type Timing = (typeof TIMINGS)[number];

export interface OfferPlace {
  id: string;
  name: string;
  owner: string | null;
}

function OfferForm({ places }: { places: OfferPlace[] }) {
  const t = useTranslations("admin.offers");
  const plans = useTranslations("plans");
  const { run, pending, error } = useAction();
  const closeDialog = useCloseDialog();
  const [kind, setKind] = useState<OfferKind>("FREE");
  const [timing, setTiming] = useState<Timing>("firstMonths");

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    const body = {
      name: text("name"),
      plan: text("plan"),
      kind,
      percentOff: kind === "PERCENT_OFF" ? Number(text("percentOff")) : undefined,
      businessId: text("businessId") || null,
      ...(timing === "firstMonths"
        ? { firstMonths: Number(text("firstMonths")) }
        : { startsOn: text("startsOn"), lastDay: text("lastDay") }),
    };
    if (await run(() => api.post("/api/admin/offers", body))) closeDialog();
  };

  return (
    <form onSubmit={(event) => void create(event)} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelledControlClass}>
          {t("name")}
          <input
            name="name"
            required
            minLength={3}
            maxLength={60}
            placeholder={t("namePlaceholder")}
            className={inputClass}
          />
        </label>
        <label className={labelledControlClass}>
          {t("plan")}
          <select name="plan" defaultValue="PRO" className={inputClass}>
            {PAID_PLANS.map((plan) => (
              <option key={plan} value={plan}>
                {plans(`names.${plan}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-xs font-semibold text-muted">{t("gives")}</legend>
        <div className="flex flex-wrap items-center gap-2">
          {OFFER_KINDS.map((option) => (
            <label key={option} className={choiceChipClass}>
              <input
                type="radio"
                name="kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
                className="sr-only"
              />
              {t(`kinds.${option}`)}
            </label>
          ))}
          {kind === "PERCENT_OFF" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                name="percentOff"
                type="number"
                min={1}
                max={99}
                required
                defaultValue={50}
                aria-label={t("percentOff")}
                className={`${inputClass} w-24`}
              />
              {t("percentSuffix")}
            </label>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-xs font-semibold text-muted">{t("when")}</legend>
        <div className="flex flex-wrap gap-2">
          {TIMINGS.map((option) => (
            <label key={option} className={choiceChipClass}>
              <input
                type="radio"
                name="timing"
                value={option}
                checked={timing === option}
                onChange={() => setTiming(option)}
                className="sr-only"
              />
              {t(`timings.${option}`)}
            </label>
          ))}
        </div>
        {timing === "firstMonths" ? (
          <label className={`${labelledControlClass} sm:max-w-xs`}>
            {t("firstMonths")}
            <input
              name="firstMonths"
              type="number"
              min={1}
              max={MAX_OFFER_FIRST_MONTHS}
              required
              defaultValue={3}
              className={inputClass}
            />
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelledControlClass}>
              {t("startsOn")}
              <input name="startsOn" type="date" required className={inputClass} />
            </label>
            <label className={labelledControlClass}>
              {t("lastDay")}
              <input name="lastDay" type="date" required className={inputClass} />
            </label>
          </div>
        )}
      </fieldset>

      <label className={labelledControlClass}>
        {t("for")}
        <select name="businessId" defaultValue="" className={inputClass}>
          <option value="">{t("forEveryPlace")}</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.owner ? `${place.name} (${place.owner})` : place.name}
            </option>
          ))}
        </select>
      </label>

      <FormError message={error} />
      <Button type="submit" className="w-fit" disabled={pending}>
        {t("create")}
      </Button>
    </form>
  );
}

/** The page's "New offer" button: the form in a pop-up. */
export function NewOfferButton({ places }: { places: OfferPlace[] }) {
  const t = useTranslations("admin.offers");
  return (
    <FormDialog label={t("newTitle")} title={t("newTitle")} intro={t("newIntro")} size="lg">
      <OfferForm places={places} />
    </FormDialog>
  );
}

/** Ends an offer after asking: hosts stop seeing it, and a free plan already taken runs to its end. */
export function EndOfferButton({ offer }: { offer: { id: string; name: string } }) {
  const t = useTranslations("admin.offers");
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();
  const end = async () => {
    const answer = await confirm({
      title: t("endTitle", { name: offer.name }),
      body: t("endBody"),
      confirmLabel: t("end"),
    });
    if (answer) await run(() => api.delete(`/api/admin/offers/${offer.id}`));
  };
  return (
    <div className="grid justify-items-end gap-1">
      {dialog}
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => void end()}>
        {t("end")}
      </Button>
      <FormError message={error} />
    </div>
  );
}
