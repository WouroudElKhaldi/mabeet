"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/** The admin sent a refund the provider kept refusing by hand, and marks it sent once, with the transfer's reference. */
export function RefundSent({ refundId }: { refundId: string }) {
  const t = useTranslations("admin.money");
  const { run, pending, error } = useAction();
  const referenceId = useId();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reference = String(new FormData(event.currentTarget).get("reference") ?? "").trim() || null;
    void run(() => api.post(`/api/admin/refunds/${refundId}`, { reference }));
  };

  return (
    <form onSubmit={submit} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={referenceId} className="sr-only">
          {t("reference")}
        </label>
        <input
          id={referenceId}
          name="reference"
          placeholder={t("reference")}
          maxLength={120}
          dir="ltr"
          className={`${inputClass} h-9 w-44`}
        />
        <Button type="submit" size="sm" disabled={pending}>
          {t("markSent")}
        </Button>
      </div>
      <FormError message={error} />
    </form>
  );
}
