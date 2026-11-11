import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { FormDialog } from "@/components/ui/form-dialog";
import { Pill } from "@/components/ui/pill";
import { StatTile } from "@/components/ui/stat-tile";
import { getPayouts } from "@/modules/bookings/server";
import { PayoutRequestForm } from "@/modules/payments";
import { isBusinessOwner } from "@/server/auth/tenant-context";
import { requirePageTenant } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate, formatMoney } from "@/utils/format";

type PageProps = { params: Promise<{ businessId: string }> };

/**
 * What guests paid online, what Mabeet holds for this place, and asking for it. The money belongs to the business,
 * so only its own owners see this page, whatever a role allows; a visiting admin
 * has the admin's money page.
 */
export default async function PayoutsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  if (!isBusinessOwner(ctx)) notFound();
  const [t, locale, data] = await Promise.all([
    getTranslations("dashboard.payouts"),
    getLocale(),
    getPayouts(ctx),
  ]);
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);
  const day = (date: Date) =>
    formatDate(toIsoDate(date), locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
        {data.balances.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("empty")}</p>
        ) : (
          data.balances.map((balance) => (
            <section
              key={balance.currency}
              aria-label={balance.currency}
              className="grid gap-3 sm:grid-cols-3"
            >
              <StatTile
                kind="money"
                currency={balance.currency}
                label={t("available")}
                value={balance.availableCents}
              />
              <StatTile
                kind="money"
                currency={balance.currency}
                label={t("upcoming")}
                value={balance.upcomingCents}
                note={t("upcomingNote")}
              />
              <StatTile
                kind="money"
                currency={balance.currency}
                label={t("paidOut")}
                value={balance.paidOutCents}
                note={
                  balance.requestedCents > 0
                    ? t("requestedNote", { amount: money(balance.requestedCents, balance.currency) })
                    : undefined
                }
              />
            </section>
          ))
        )}

        <div>
          <FormDialog label={t("requestTitle")} title={t("requestTitle")} size="lg">
            <PayoutRequestForm
              businessId={businessId}
              balances={data.balances.map(({ currency, availableCents }) => ({ currency, availableCents }))}
              last={data.lastDetails}
            />
          </FormDialog>
        </div>

        <Panel title={t("history")}>
          {data.payouts.length === 0 ? (
            <p className="text-sm text-muted">{t("noPayouts")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.payouts.map((payout) => (
                <li key={payout.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums">{money(payout.amountCents, payout.currency)}</p>
                    <p className="text-sm text-muted">
                      {t(`methods.${payout.method}`)} · {day(payout.createdAt)}
                      {payout.reference && (
                        <>
                          {" · "}
                          <bdi dir="ltr">{payout.reference}</bdi>
                        </>
                      )}
                    </p>
                    {payout.status === "REJECTED" && payout.adminNote && (
                      <p className="text-sm text-muted">
                        <bdi>{payout.adminNote}</bdi>
                      </p>
                    )}
                  </div>
                  <Pill tone={payout.status === "REQUESTED" ? "accent" : "quiet"}>
                    {t(`status.${payout.status}`)}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("payments")}>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted">{t("noPayments")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <bdi>{payment.booking?.guestName}</bdi>
                    </p>
                    <p className="text-sm text-muted">
                      <bdi dir="ltr">{payment.booking?.reference}</bdi> ·{" "}
                      {payment.method === "WHISH" ? t("methods.WHISH") : t("card")}
                      {payment.paidAt && ` · ${day(payment.paidAt)}`}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {money(payment.amountCents, payment.currency)}
                    {payment.refundedCents > 0 && (
                      <span className="ms-2 text-sm font-normal text-muted">
                        {t("refunded", { amount: money(payment.refundedCents, payment.currency) })}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
