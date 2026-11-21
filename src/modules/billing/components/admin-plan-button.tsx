"use client";

import type { Plan } from "@prisma/client";
import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass, LabeledControl } from "@/components/ui/field";
import { FormDialog, useCloseDialog } from "@/components/ui/form-dialog";
import { FormError } from "@/components/ui/form-error";
import { PLANS } from "@/config/plans";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

function AdminPlanForm({ hostId, plan }: { hostId: string; plan: Plan }) {
  const t = useTranslations("admin.plan");
  const names = useTranslations("plans.names");
  const { run, pending, error } = useAction();
  const closeDialog = useCloseDialog();
  const [chosen, setChosen] = useState<Plan>(plan);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lastDay = String(new FormData(event.currentTarget).get("lastDay") ?? "");
    const saved = await run(() =>
      api.patch(`/api/admin/hosts/${hostId}/plan`, {
        plan: chosen,
        lastDay: chosen === "FREE" || !lastDay ? null : lastDay,
      }),
    );
    if (saved) closeDialog();
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <LabeledControl label={t("plan")}>
          <select
            name="plan"
            value={chosen}
            onChange={(event) => setChosen(PLANS.find((value) => value === event.target.value) ?? plan)}
            className={inputClass}
          >
            {PLANS.map((value) => (
              <option key={value} value={value}>
                {names(value)}
              </option>
            ))}
          </select>
        </LabeledControl>
        {chosen === "FREE" ? null : (
          <LabeledControl label={t("lastDay")} hint={t("lastDayHint")}>
            <input name="lastDay" type="date" className={inputClass} />
          </LabeledControl>
        )}
      </fieldset>
      <FormError message={error} />
      <Button type="submit" className="w-fit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}

/**
 * On the admin's host page: set the host's plan by hand, for all their places, until a last day or with no end. A
 * host paying by card has their plan from Stripe, so the button says so instead of opening.
 */
export function AdminPlanButton({
  hostId,
  hostName,
  plan,
  paysByCard,
}: {
  hostId: string;
  hostName: string;
  plan: Plan;
  paysByCard: boolean;
}) {
  const t = useTranslations("admin.plan");
  if (paysByCard) return <span className="text-sm text-muted">{t("byCard")}</span>;
  return (
    <FormDialog
      label={t("change")}
      title={t("title", { name: hostName })}
      intro={t("intro")}
      icon={<CreditCard className="size-4" aria-hidden />}
      variant="secondary"
    >
      <AdminPlanForm hostId={hostId} plan={plan} />
    </FormDialog>
  );
}
