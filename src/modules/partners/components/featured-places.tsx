"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { inputClass, labelledControlClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { addDays, parseIsoDate, toIsoDate } from "@/utils/dates";
import { formatStayDates } from "@/utils/format";

export interface FeaturedDays {
  id: string;
  /** Null once the place has closed. */
  placeName: string | null;
  placeSlug: string | null;
  startsOn: string;
  /** The day after the last one, like a check-out. */
  endsOn: string;
}

const URL = "/api/admin/featured-places";

/**
 * The guesthouses featured from today on, each with End, and a form to feature one more: the admin picks the place,
 * the first day and the last day; the API takes the day after the last, so the form adds it.
 */
export function FeaturedPlaces({
  featured,
  places,
}: {
  featured: FeaturedDays[];
  /** The open guesthouses the admin may pick from. */
  places: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("admin.partners");
  const locale = useLocale();
  const { run, pending, error, fieldErrors } = useAction(["endsOn"]);
  const { confirm, dialog } = useConfirm();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const lastDay = parseIsoDate(String(data.get("lastDay")));
    const saved = await run(() =>
      api.post(URL, {
        businessId: data.get("businessId"),
        startsOn: data.get("firstDay"),
        endsOn: toIsoDate(addDays(lastDay, 1)),
      }),
    );
    if (saved) form.reset();
  };

  const end = async (days: FeaturedDays) => {
    const answer = await confirm({
      title: t("endFeatureTitle", { name: days.placeName ?? t("closedPlace") }),
      confirmLabel: t("endFeature"),
    });
    if (answer) await run(() => api.delete(`${URL}/${days.id}`));
  };

  return (
    <div>
      {dialog}
      {featured.length === 0 ? (
        <p className="text-sm text-faint">{t("noFeatured")}</p>
      ) : (
        <ul className="grid gap-2">
          {featured.map((days) => (
            <li
              key={days.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-2.5 text-sm"
            >
              <span className="min-w-0">
                {days.placeSlug ? (
                  <Link
                    href={`/p/${days.placeSlug}`}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    <bdi>{days.placeName}</bdi>
                  </Link>
                ) : (
                  <span className="font-semibold">{t("closedPlace")}</span>
                )}
                <span className="text-muted">
                  {" · "}
                  {formatStayDates(
                    parseIsoDate(days.startsOn),
                    addDays(parseIsoDate(days.endsOn), -1),
                    locale,
                  )}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => void end(days)}
                aria-label={t("endFeature")}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-50"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(event) => void submit(event)}
        className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end"
      >
        <label className={labelledControlClass}>
          {t("featuredPlace")}
          <select name="businessId" required defaultValue="" className={`${inputClass} h-11`}>
            <option value="" disabled>
              {t("pickPlace")}
            </option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelledControlClass}>
          {t("firstDay")}
          <input name="firstDay" type="date" required className={`${inputClass} h-11`} />
        </label>
        <label className={labelledControlClass}>
          {t("lastDay")}
          <input name="lastDay" type="date" required className={`${inputClass} h-11`} />
        </label>
        <Button type="submit" disabled={pending}>
          {t("feature")}
        </Button>
      </form>
      <FormError message={fieldErrors.endsOn ? t("errors.lastDay") : error} />
    </div>
  );
}
