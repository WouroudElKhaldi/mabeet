"use client";

import type { PayoutMethod } from "@prisma/client";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field, inputClass, LabeledControl } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { PAYOUT_METHODS } from "@/config/enums";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/utils/format";

/** The smallest payout the API takes, in minor units (`payoutRequestInput`). */
const SMALLEST_PAYOUT_CENTS = 100;

interface PayoutDetails {
  method: PayoutMethod;
  accountName: string;
  bankName: string | null;
  iban: string | null;
  whishPhone: string | null;
}

interface PayoutRequestFormProps {
  businessId: string;
  balances: Array<{ currency: string; availableCents: number }>;
  /** The details used last time, so the next request is quicker. */
  last: PayoutDetails | null;
}

/**
 * Asks Mabeet to send the available money to a Whish number or a bank account (an IBAN). Never card numbers. The
 * amount starts at everything available, the most common request; the server checks it again under a lock.
 */
export function PayoutRequestForm({ businessId, balances, last }: PayoutRequestFormProps) {
  const t = useTranslations("dashboard.payouts");
  const locale = useLocale();
  const { run, pending, error, fieldErrors } = useAction([
    "amountCents",
    "accountName",
    "whishPhone",
    "bankName",
    "iban",
  ]);
  const payable = balances.filter((balance) => balance.availableCents >= SMALLEST_PAYOUT_CENTS);
  const [currency, setCurrency] = useState(payable[0]?.currency ?? "");
  const [method, setMethod] = useState<PayoutMethod>(last?.method ?? "WHISH");
  const [sent, setSent] = useState(false);
  const available = payable.find((balance) => balance.currency === currency)?.availableCents ?? 0;

  if (payable.length === 0) return <p className="text-sm text-muted">{t("nothingAvailable")}</p>;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim() || null;
    setSent(false);
    const done = await run(() =>
      api.post(`/api/workspaces/${businessId}/payouts`, {
        amountCents: Math.round(Number(data.get("amount")) * 100),
        currency,
        method,
        accountName: text("accountName"),
        bankName: method === "BANK_TRANSFER" ? text("bankName") : null,
        iban: method === "BANK_TRANSFER" ? text("iban") : null,
        whishPhone: method === "WHISH" ? (text("whishPhone")?.replace(/[\s-]/g, "") ?? null) : null,
      }),
    );
    setSent(done);
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <LabeledControl label={t("currency")}>
        <select value={currency} onChange={(event) => setCurrency(event.target.value)} className={inputClass}>
          {payable.map((balance) => (
            <option key={balance.currency} value={balance.currency}>
              {balance.currency} · {formatMoney(balance.availableCents, balance.currency, locale)}
            </option>
          ))}
        </select>
      </LabeledControl>
      <Field
        // A new currency has its own balance, so the amount starts again at all of it.
        key={currency}
        label={t("amount")}
        name="amount"
        type="number"
        inputMode="decimal"
        min={(SMALLEST_PAYOUT_CENTS / 100).toFixed(2)}
        step="0.01"
        max={(available / 100).toFixed(2)}
        defaultValue={(available / 100).toFixed(2)}
        error={fieldErrors.amountCents ? t("errors.amount") : undefined}
        required
      />
      <div className="sm:col-span-2">
        <ChoiceChips
          legend={t("method")}
          name="method"
          choices={PAYOUT_METHODS.map((value) => ({ value, label: t(`methods.${value}`) }))}
          value={method}
          onChange={setMethod}
        />
      </div>
      <Field
        label={t("accountName")}
        name="accountName"
        autoComplete="name"
        defaultValue={last?.accountName}
        error={fieldErrors.accountName ? t("errors.accountName") : undefined}
        required
      />
      {method === "WHISH" ? (
        <Field
          label={t("whishPhone")}
          name="whishPhone"
          type="tel"
          autoComplete="tel"
          placeholder="+96170123456"
          defaultValue={last?.whishPhone ?? ""}
          error={fieldErrors.whishPhone ? t("errors.whishPhone") : undefined}
          required
        />
      ) : (
        <>
          <Field
            label={t("bankName")}
            name="bankName"
            defaultValue={last?.bankName ?? ""}
            error={fieldErrors.bankName ? t("errors.bankName") : undefined}
            required
          />
          <Field
            label={t("iban")}
            name="iban"
            dir="ltr"
            placeholder="LB62 0999 0000 0001 0019 0122 9114"
            defaultValue={last?.iban ?? ""}
            hint={t("ibanHint")}
            error={fieldErrors.iban ? t("errors.iban") : undefined}
            required
          />
        </>
      )}
      <p className="text-xs text-muted sm:col-span-2">{t("noCards")}</p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("request")}
        </Button>
        {sent && (
          <p role="status" className="text-sm font-semibold text-success">
            {t("requested")}
          </p>
        )}
      </div>
      <FormError message={error} />
    </form>
  );
}
