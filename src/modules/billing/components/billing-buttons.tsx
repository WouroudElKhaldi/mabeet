"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import type { PaidPlan } from "@/config/plans";
import { useRedirectAction } from "@/hooks/use-redirect-action";
import { api } from "@/lib/api-client";

// The plan buttons on the billing page. Each asks our server for a payment page (Stripe Checkout, Stripe's billing
// portal or Whish) and goes there; the plan itself changes only once Stripe or Whish confirms the payment.

/** One button that asks the server for a payment page and goes there, with its error under it. */
function PaymentPageButton({
  path,
  body,
  label,
  variant,
  disabled = false,
  className,
}: {
  path: string;
  body: unknown;
  label: string;
  variant?: "secondary";
  disabled?: boolean;
  className?: string;
}) {
  const { run, pending, error } = useRedirectAction();
  return (
    <div className={className}>
      <Button
        variant={variant}
        className="w-full"
        disabled={disabled || pending}
        onClick={() => run(() => api.post<{ url: string }>(path, body))}
      >
        {label}
      </Button>
      <FormError message={error} className="mt-2" />
    </div>
  );
}

/** Pays a plan by card: a Stripe subscription, renewed every month until it is cancelled in the portal. */
export function UpgradeButton({ businessId, plan }: { businessId: string; plan: PaidPlan }) {
  const t = useTranslations("plans");
  return (
    <PaymentPageButton
      path={`/api/workspaces/${businessId}/billing/checkout`}
      body={{ plan }}
      label={t("choose", { plan: t(`names.${plan}`) })}
    />
  );
}

/** Pays one month of a plan with Whish, for hosts without a card. Each payment adds a month. */
export function WhishPlanButton({ businessId, plan }: { businessId: string; plan: PaidPlan }) {
  const t = useTranslations("plans");
  return (
    <PaymentPageButton
      path={`/api/workspaces/${businessId}/billing/whish`}
      body={{ plan }}
      label={t("payWhish")}
      variant="secondary"
      className="mt-2"
    />
  );
}

/** Stripe's billing portal, for a business that pays by card: change plan, update the card, cancel. */
export function ManageBillingButton({ businessId }: { businessId: string }) {
  const t = useTranslations("plans");
  return (
    <PaymentPageButton
      path={`/api/workspaces/${businessId}/billing/portal`}
      body={{}}
      label={t("manage")}
      variant="secondary"
      className="w-fit"
    />
  );
}
