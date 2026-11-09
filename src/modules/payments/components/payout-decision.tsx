"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/**
 * The admin sent a payout by hand from Mabeet's Whish or Stripe account and marks it sent, with the transfer's
 * reference, or refuses it. Each payout is decided once; the server refuses a second answer.
 */
export function PayoutDecision({ payoutId }: { payoutId: string }) {
  const t = useTranslations("admin.money");
  const { run, pending, error } = useAction();
  const [reference, setReference] = useState("");
  const referenceId = useId();
  const decide = (action: "paid" | "rejected") =>
    run(() => api.post(`/api/admin/payouts/${payoutId}`, { action, reference: reference.trim() || null }));

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={referenceId} className="sr-only">
          {t("reference")}
        </label>
        <input
          id={referenceId}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder={t("reference")}
          maxLength={120}
          dir="ltr"
          className={`${inputClass} h-9 w-44`}
        />
        <Button size="sm" disabled={pending} onClick={() => void decide("paid")}>
          {t("markPaid")}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => void decide("rejected")}>
          {t("reject")}
        </Button>
      </div>
      <FormError message={error} />
    </div>
  );
}
