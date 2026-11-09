import { getLocale, getTranslations } from "next-intl/server";
import { PlanCards } from "@/components/billing/plan-cards";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/shell/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { PLANS, type PlanName } from "@/config/plans";
import { ManageBillingButton, UpgradeButton, WhishPlanButton } from "@/modules/billing";
import { getBilling, settlePlanPayment } from "@/modules/billing/server";
import { requirePageAccess } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate } from "@/utils/format";

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ checkout?: string; whish?: string }>;
};

const noticeClass = "rounded-xl bg-surface-2 p-4 text-sm";

/**
 * The business's plan, what it uses against the plan's limits, and the ways to pay for a bigger one: by card (a
 * Stripe subscription, changed later in Stripe's portal) or a month at a time with Whish. Plans are paid instantly;
 * nothing is paid by hand and nothing waits for an admin.
 */
export default async function BillingPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const { checkout, whish } = await searchParams;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.billing.anyOf);
  // Back from Whish: ask Whish now rather than wait for its callback, so the new plan shows on arrival.
  const whishResult = whish ? await settlePlanPayment(whish).catch(() => "pending" as const) : null;
  const [t, locale, billing] = await Promise.all([getTranslations("plans"), getLocale(), getBilling(ctx)]);
  const allowed = (max: number | null) =>
    max === null ? t("unlimited") : t("usage.allowed", { count: max });
  const usage = [
    { label: t("usage.rooms"), used: billing.usage.rooms, max: billing.limits.rooms },
    { label: t("usage.offerings"), used: billing.usage.offerings, max: billing.limits.offerings },
    { label: t("usage.members"), used: billing.usage.members, max: billing.limits.members },
  ];
  const higher = (plan: PlanName) => PLANS.indexOf(plan) > PLANS.indexOf(billing.plan);
  // A business paying by card changes plan in Stripe's portal, so it never ends up with two subscriptions.
  const canPay = billing.canManage && !billing.paysByCard;
  const renews = billing.renewsAt
    ? t("renews", {
        date: formatDate(toIsoDate(billing.renewsAt), locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      })
    : null;

  return (
    <>
      <PageHeader
        title={t("billingTitle")}
        intro={[t("currentPlan", { plan: t(`names.${billing.plan}`) }), renews].filter(Boolean).join(" · ")}
        actions={
          billing.paysByCard && billing.canManage ? <ManageBillingButton businessId={businessId} /> : null
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
        {(checkout === "done" || whishResult) && (
          <p role="status" className={`${noticeClass} font-semibold`}>
            {checkout === "done" || whishResult === "paid"
              ? t("thanks")
              : whishResult === "failed"
                ? t("whishFailed")
                : t("whishPending")}
          </p>
        )}
        {!billing.cardEnabled && !billing.whishEnabled ? (
          <p className={`${noticeClass} text-muted`}>{t("notConfigured")}</p>
        ) : (
          !billing.cardEnabled && <p className={`${noticeClass} text-muted`}>{t("cardOff")}</p>
        )}
        {!billing.canManage && <p className="text-sm text-muted">{t("ownersOnly")}</p>}

        <section aria-label={t("usage.title")} className="grid gap-3 sm:grid-cols-3">
          {usage.map((row) => (
            <StatTile
              key={row.label}
              kind="count"
              label={row.label}
              value={row.used}
              note={allowed(row.max)}
            />
          ))}
        </section>

        <PlanCards
          current={billing.plan}
          action={(plan) =>
            plan !== "FREE" && canPay && (higher(plan) || plan === billing.plan) ? (
              <>
                {billing.cardEnabled && higher(plan) && <UpgradeButton businessId={businessId} plan={plan} />}
                {billing.whishEnabled && <WhishPlanButton businessId={businessId} plan={plan} />}
              </>
            ) : null
          }
        />
        <p className="text-sm text-muted">{t("noCommission")}</p>
      </div>
    </>
  );
}
