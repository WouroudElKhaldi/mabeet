"use client";

import { Tag, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { inputClass, labelledControlClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { addDays, parseIsoDate, toIsoDate } from "@/utils/dates";
import { formatMoney, formatStayDates } from "@/utils/format";

export interface SpecialPriceRun {
  checkIn: string;
  /** The morning after the last night, like a check-out date. */
  checkOut: string;
  rateCents: number;
}

/** Holiday and weekend prices: one price for every night of a range, listed as runs, each removable. */
export function SpecialPrices({
  businessId,
  roomId,
  currency,
  baseRateCents,
  runs,
  canEdit,
}: {
  businessId: string;
  roomId: string;
  currency: string;
  baseRateCents: number;
  runs: SpecialPriceRun[];
  canEdit: boolean;
}) {
  const t = useTranslations("dashboard.rooms.prices");
  const locale = useLocale();
  const { run, pending, error } = useAction();
  const url = `/api/workspaces/${businessId}/rooms/${roomId}/prices`;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const lastNight = parseIsoDate(String(data.get("lastNight")));
    const saved = await run(() =>
      api.put(url, {
        checkIn: data.get("firstNight"),
        checkOut: toIsoDate(addDays(lastNight, 1)),
        rateCents: Math.round(Number(data.get("rate")) * 100),
      }),
    );
    if (saved) form.reset();
  };

  const clear = (price: SpecialPriceRun) =>
    void run(() => api.put(url, { checkIn: price.checkIn, checkOut: price.checkOut, rateCents: null }));

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Tag className="size-4 text-accent" aria-hidden />
        {t("title")}
      </h3>
      <p className="mt-1 text-sm text-muted">
        {t("hint", { base: formatMoney(baseRateCents, currency, locale) })}
      </p>

      {runs.length === 0 ? (
        <p className="mt-4 text-sm text-faint">{t("none")}</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {runs.map((price) => (
            <li
              key={price.checkIn}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-2.5 text-sm"
            >
              <span>
                {formatStayDates(parseIsoDate(price.checkIn), parseIsoDate(price.checkOut), locale)}
                <span className="ms-3 font-semibold">
                  {t("perNight", { price: formatMoney(price.rateCents, currency, locale) })}
                </span>
              </span>
              {canEdit && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => clear(price)}
                  aria-label={t("remove")}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-50"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        >
          <label className={labelledControlClass}>
            {t("firstNight")}
            <input name="firstNight" type="date" required className={`${inputClass} h-11`} />
          </label>
          <label className={labelledControlClass}>
            {t("lastNight")}
            <input name="lastNight" type="date" required className={`${inputClass} h-11`} />
          </label>
          <label className={labelledControlClass}>
            {t("price", { currency })}
            <input
              name="rate"
              type="number"
              min="1"
              step="0.01"
              required
              inputMode="decimal"
              className={`${inputClass} h-11`}
            />
          </label>
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
        </form>
      )}
      <FormError message={error} />
    </section>
  );
}
