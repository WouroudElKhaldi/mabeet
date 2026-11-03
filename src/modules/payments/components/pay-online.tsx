"use client";

import { CreditCard, LoaderCircle, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import type { OnlinePaymentMethod } from "@/config/enums";
import { useRedirectAction } from "@/hooks/use-redirect-action";
import { api } from "@/lib/api-client";

const METHOD_ICONS = { WHISH: Wallet, CARD: CreditCard } as const;
const METHOD_LABELS = { WHISH: "whish", CARD: "card" } as const;

/**
 * The guest's buttons to pay their booking in full: one per way to pay this booking's currency
 * (`onlinePaymentMethods`), Whish first. A press asks the API for the payment page and goes there; until the page
 * opens, the pressed button spins and both are disabled, so a double tap never starts two payments. The booking's
 * page shows these only while it waits for the payment (`AWAITING_PAYMENT`), under the amount and the countdown.
 */
export function PayOnline({ token, methods }: { token: string; methods: OnlinePaymentMethod[] }) {
  const t = useTranslations("confirmation.pay");
  const { run, pending, error } = useRedirectAction();
  const [chosen, setChosen] = useState<OnlinePaymentMethod | null>(null);

  if (methods.length === 0) return <p className="text-sm text-muted">{t("unavailable")}</p>;

  const pay = (method: OnlinePaymentMethod) => {
    setChosen(method);
    void run(() => api.post<{ url: string }>(`/api/public/bookings/${token}/checkout`, { method }));
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:flex sm:flex-wrap">
        {methods.map((method) => {
          const spinning = pending && chosen === method;
          return (
            <Button
              key={method}
              size="lg"
              variant={method === "WHISH" ? "primary" : "secondary"}
              disabled={pending}
              aria-busy={spinning || undefined}
              onClick={() => pay(method)}
              className={`w-full sm:w-auto ${slideParent}`}
            >
              <SlideLabel icon={spinning ? LoaderCircle : METHOD_ICONS[method]} spinning={spinning}>
                {t(METHOD_LABELS[method])}
              </SlideLabel>
            </Button>
          );
        })}
      </div>
      <FormError message={error} />
    </div>
  );
}
