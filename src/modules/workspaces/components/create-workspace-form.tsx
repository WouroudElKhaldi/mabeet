"use client";

import { ArrowRight, CreditCard, LoaderCircle, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLink } from "@/components/ui/arrow-link";
import { type Choice, ChoiceChips } from "@/components/ui/choice-chips";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { type PaidPlan, PLAN_PAYMENT_METHODS, type PlanPaymentMethod } from "@/config/plans";
import { useRedirectAction } from "@/hooks/use-redirect-action";
import { api } from "@/lib/api-client";

const METHOD_ICONS = { card: CreditCard, whish: Smartphone } as const;
const CHECKOUT_PATH: Record<PlanPaymentMethod, string> = { card: "checkout", whish: "whish" };

const dashboardOf = (businessId: string) => `/dashboard/${businessId}`;
/** A new place on Free goes straight into its guided setup. */
const setupOf = (businessId: string) => `${dashboardOf(businessId)}/setup`;

/**
 * Creates a host's workspace. With a paid plan chosen on /pricing, it then goes straight on to paying for it (by
 * card or Whish), and the plan starts when the payment is confirmed. The workspace is created once: if paying
 * fails, trying again only pays, and the host can also go on with Free.
 */
export function CreateWorkspaceForm({
  plan,
  methods,
}: {
  plan?: PaidPlan;
  methods: Record<PlanPaymentMethod, boolean>;
}) {
  const t = useTranslations("host");
  const offered = PLAN_PAYMENT_METHODS.filter((method) => methods[method]);
  const paying = plan !== undefined && offered.length > 0;
  const [method, setMethod] = useState<PlanPaymentMethod>(offered[0] ?? "card");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const { run, pending, error } = useRedirectAction();

  const choices: Choice<PlanPaymentMethod>[] = offered.map((value) => ({
    value,
    label: t(`payMethods.${value}`),
    icon: METHOD_ICONS[value],
  }));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      const businessId =
        createdId ??
        (
          await api.post<{ id: string }>("/api/workspaces", {
            name: data.get("name"),
            area: String(data.get("area") ?? "") || undefined,
          })
        ).id;
      setCreatedId(businessId);
      if (!paying) return { url: setupOf(businessId) };
      return api.post<{ url: string }>(`/api/workspaces/${businessId}/billing/${CHECKOUT_PATH[method]}`, {
        plan,
      });
    });
  };

  const label = createdId ? t("retryPay") : paying ? t("createAndPay") : t("create");

  return (
    <form onSubmit={submit} className="rise-in-sequence grid gap-5">
      <Field
        label={t("placeName")}
        name="name"
        required
        minLength={2}
        maxLength={80}
        disabled={createdId !== null}
      />
      <Field label={t("area")} name="area" maxLength={80} disabled={createdId !== null} />
      {paying && choices.length > 1 ? (
        <ChoiceChips
          legend={t("payWith")}
          name="method"
          choices={choices}
          value={method}
          onChange={setMethod}
          disabled={pending}
        />
      ) : null}
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending} className={`w-full ${slideParent}`}>
        <SlideLabel icon={pending ? LoaderCircle : ArrowRight} flipInRtl={!pending} spinning={pending}>
          {label}
        </SlideLabel>
      </Button>
      {createdId ? <ArrowLink href={dashboardOf(createdId)}>{t("startFreeInstead")}</ArrowLink> : null}
    </form>
  );
}
