"use client";

import type { OfferKind } from "@prisma/client";
import { Gift } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Panel } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import type { Locale } from "@/config/appearance";
import type { PaidPlan } from "@/config/plans";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { toIsoDate } from "@/utils/dates";
import { formatDate, formatMoney } from "@/utils/format";

export interface OpenOffer {
  id: string;
  name: string;
  plan: PaidPlan;
  kind: OfferKind;
  percentOff: number | null;
  until: Date;
  monthlyCents: number;
}

/**
 * The offers open to a place, on its billing page. A free one is taken here in one click and runs to its end date; a
 * share off needs nothing: the checkout takes it off by itself, so the line only says so. Only an owner not paying by
 * card can take a free one.
 */
export function PlanOffers({
  businessId,
  offers,
  canClaim,
}: {
  businessId: string;
  offers: OpenOffer[];
  canClaim: boolean;
}) {
  const t = useTranslations("plans");
  const locale = useLocale() as Locale;
  const { run, pending, error } = useAction();
  const until = (date: Date) =>
    formatDate(toIsoDate(date), locale, { day: "numeric", month: "long", year: "numeric" });

  return (
    <Panel title={t("offers.title")} intro={t("offers.intro")}>
      <ul className="grid gap-2">
        {offers.map((offer) => {
          const plan = t(`names.${offer.plan}`);
          return (
            <li
              key={offer.id}
              className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-line sm:flex-row sm:items-center"
            >
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"
              >
                <Gift className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{offer.name}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {offer.kind === "FREE"
                    ? t("offers.free", { plan, date: until(offer.until) })
                    : t("offers.percent", {
                        plan,
                        percent: offer.percentOff ?? 0,
                        price: formatMoney(offer.monthlyCents, "USD", locale),
                        date: until(offer.until),
                      })}
                </p>
              </div>
              {offer.kind === "FREE" && canClaim ? (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    void run(() =>
                      api.post(`/api/workspaces/${businessId}/billing/offers/${offer.id}/claim`, {}),
                    )
                  }
                >
                  {t("offers.claim", { plan })}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <FormError message={error} className="mt-3" />
    </Panel>
  );
}
