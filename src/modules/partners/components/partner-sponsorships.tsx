"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { inputClass, labelledControlClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { addDays, parseIsoDate, toIsoDate } from "@/utils/dates";
import { formatStayDates } from "@/utils/format";

export interface SponsorshipDays {
  id: string;
  startsOn: string;
  /** The day after the last one, like a check-out. */
  endsOn: string;
}

/**
 * The days a partner is sponsored, and a form for more. The admin picks the first and the last day; the API takes
 * the day after the last, so the form adds it.
 */
export function PartnerSponsorships({
  partnerId,
  partnerName,
  sponsorships,
}: {
  partnerId: string;
  partnerName: string;
  sponsorships: SponsorshipDays[];
}) {
  const t = useTranslations("admin.partners");
  const locale = useLocale();
  const { run, pending, error, fieldErrors } = useAction(["endsOn"]);
  const { confirm, dialog } = useConfirm();
  const url = `/api/admin/partners/${partnerId}/sponsorships`;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const lastDay = parseIsoDate(String(data.get("lastDay")));
    const saved = await run(() =>
      api.post(url, { startsOn: data.get("firstDay"), endsOn: toIsoDate(addDays(lastDay, 1)) }),
    );
    if (saved) form.reset();
  };

  const end = async (sponsorship: SponsorshipDays) => {
    const answer = await confirm({
      title: t("endTitle", { name: partnerName }),
      confirmLabel: t("endSponsorship"),
    });
    if (answer) await run(() => api.delete(`${url}/${sponsorship.id}`));
  };

  return (
    <section className="mt-6 border-t border-line pt-6" aria-label={t("sponsorships")}>
      {dialog}
      <h3 className="text-lg font-semibold">{t("sponsorships")}</h3>
      <p className="mt-1 text-sm text-muted">{t("sponsorshipsHint")}</p>

      {sponsorships.length === 0 ? (
        <p className="mt-4 text-sm text-faint">{t("noSponsorships")}</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {sponsorships.map((sponsorship) => (
            <li
              key={sponsorship.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-2.5 text-sm"
            >
              <span>
                {formatStayDates(
                  parseIsoDate(sponsorship.startsOn),
                  addDays(parseIsoDate(sponsorship.endsOn), -1),
                  locale,
                )}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => void end(sponsorship)}
                aria-label={t("endSponsorship")}
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
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <label className={labelledControlClass}>
          {t("firstDay")}
          <input name="firstDay" type="date" required className={`${inputClass} h-11`} />
        </label>
        <label className={labelledControlClass}>
          {t("lastDay")}
          <input name="lastDay" type="date" required className={`${inputClass} h-11`} />
        </label>
        <Button type="submit" disabled={pending}>
          {t("sponsor")}
        </Button>
      </form>
      <FormError message={fieldErrors.endsOn ? t("errors.lastDay") : error} />
    </section>
  );
}
