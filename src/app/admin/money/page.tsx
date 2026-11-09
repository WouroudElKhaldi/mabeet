import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { Pill } from "@/components/ui/pill";
import { StatTile } from "@/components/ui/stat-tile";
import { getPlanRevenue } from "@/modules/billing/server";
import { RefundSent } from "@/modules/bookings";
import { getHostBalances, listRefundsToSend } from "@/modules/bookings/server";
import { PayoutDecision } from "@/modules/payments";
import { getPayoutQueue } from "@/modules/payments/server";
import { listPlatformBusinesses } from "@/modules/workspaces/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate, formatMoney } from "@/utils/format";

/** The currency the revenue tiles show; every plan is priced in it. */
const PLAN_CURRENCY = "USD";

/**
 * The platform's money: what Mabeet earned from plans, the payouts hosts asked for (sent by hand from Mabeet's Whish
 * or Stripe account, then marked here), what Mabeet holds for each host, and refunds a provider kept refusing.
 */
export default async function AdminMoneyPage() {
  const actor = await requirePageAdmin();
  const [t, tPayouts, locale, revenue, queue, balances, refunds, places] = await Promise.all([
    getTranslations("admin.money"),
    getTranslations("dashboard.payouts"),
    getLocale(),
    getPlanRevenue(actor),
    getPayoutQueue(actor),
    getHostBalances(actor),
    listRefundsToSend(actor),
    listPlatformBusinesses(actor),
  ]);
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);
  const day = (date: Date) => formatDate(toIsoDate(date), locale);
  const usd = (rows: Array<{ currency: string; cents: number; payments?: number }>) =>
    rows.find((row) => row.currency === PLAN_CURRENCY);
  const names = new Map(places.businesses.map((business) => [business.id, business.name]));
  const months = [...new Set(revenue.byMonth.map((row) => row.month))].reverse();

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
        <section aria-label={t("earnedAll")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            kind="money"
            currency={PLAN_CURRENCY}
            label={t("earnedAll")}
            value={usd(revenue.allTime)?.cents ?? 0}
          />
          <StatTile
            kind="money"
            currency={PLAN_CURRENCY}
            label={t("earnedMonth")}
            value={usd(revenue.thisMonth)?.cents ?? 0}
            note={t("payments", { count: usd(revenue.thisMonth)?.payments ?? 0 })}
          />
          <StatTile
            kind="money"
            currency={PLAN_CURRENCY}
            label={t("byCard")}
            value={usd(revenue.byCard)?.cents ?? 0}
            note={t("payments", { count: usd(revenue.byCard)?.payments ?? 0 })}
          />
          <StatTile
            kind="money"
            currency={PLAN_CURRENCY}
            label={t("byWhish")}
            value={usd(revenue.byWhish)?.cents ?? 0}
            note={t("payments", { count: usd(revenue.byWhish)?.payments ?? 0 })}
          />
        </section>

        <Panel title={t("requests")}>
          {queue.requests.length === 0 ? (
            <p className="text-sm text-muted">{t("noRequests")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {queue.requests.map((payout) => (
                <li
                  key={payout.id}
                  className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <span className="tabular-nums">{money(payout.amountCents, payout.currency)}</span> ·{" "}
                      <bdi>{payout.business.name}</bdi>
                    </p>
                    <p className="text-sm text-muted">
                      {tPayouts(`methods.${payout.method}`)} · <bdi>{payout.accountName}</bdi> ·{" "}
                      <bdi dir="ltr">
                        {payout.method === "WHISH" ? payout.whishPhone : `${payout.bankName} ${payout.iban}`}
                      </bdi>
                    </p>
                    <p className="text-sm text-muted">{day(payout.createdAt)}</p>
                  </div>
                  <PayoutDecision payoutId={payout.id} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("owed")} intro={t("owedIntro")}>
          {balances.length === 0 ? (
            <p className="text-sm text-muted">{t("nothingOwed")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {balances.map((balance) => (
                <li
                  key={`${balance.businessId}:${balance.currency}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <bdi className="min-w-0 font-semibold">
                    {names.get(balance.businessId) ?? balance.businessId}
                  </bdi>
                  <p className="text-sm text-muted tabular-nums">
                    {t("available")} {money(balance.availableCents, balance.currency)} · {t("upcoming")}{" "}
                    {money(balance.upcomingCents, balance.currency)} · {t("requested")}{" "}
                    {money(balance.requestedCents, balance.currency)} · {t("paidOut")}{" "}
                    {money(balance.paidOutCents, balance.currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("refunds")} intro={t("refundsIntro")}>
          {refunds.length === 0 ? (
            <p className="text-sm text-muted">{t("noRefunds")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {refunds.map((refund) => {
                const booking = refund.payment.booking;
                return (
                  <li
                    key={refund.id}
                    className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        <span className="tabular-nums">{money(refund.amountCents, refund.currency)}</span> ·{" "}
                        <bdi>{booking?.guestName}</bdi>
                      </p>
                      <p className="text-sm text-muted">
                        <bdi>{refund.business.name}</bdi> · <bdi dir="ltr">{booking?.reference}</bdi> ·{" "}
                        {refund.payment.method === "WHISH" ? tPayouts("methods.WHISH") : t("card")}
                        {booking?.guestPhone && (
                          <>
                            {" · "}
                            <bdi dir="ltr">{booking.guestPhone}</bdi>
                          </>
                        )}
                      </p>
                      <p className="text-sm text-muted">{day(refund.createdAt)}</p>
                    </div>
                    <RefundSent refundId={refund.id} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t("byMonth")}>
          {months.length === 0 ? (
            <p className="text-sm text-muted">{t("payments", { count: 0 })}</p>
          ) : (
            <ul className="divide-y divide-line">
              {months.map((month) => {
                const rows = revenue.byMonth.filter(
                  (row) => row.month === month && row.currency === PLAN_CURRENCY,
                );
                const cents = rows.reduce((sum, row) => sum + row.cents, 0);
                const count = rows.reduce((sum, row) => sum + row.payments, 0);
                return (
                  <li key={month} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="font-semibold">
                      {formatDate(`${month}-01`, locale, { month: "long", year: "numeric" })}
                    </span>
                    <span className="text-muted tabular-nums">
                      {money(cents, PLAN_CURRENCY)} · {t("payments", { count })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t("recent")}>
          {queue.recent.length === 0 ? (
            <p className="text-sm text-muted">{tPayouts("noPayouts")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {queue.recent.map((payout) => (
                <li key={payout.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <span className="tabular-nums">{money(payout.amountCents, payout.currency)}</span> ·{" "}
                      <bdi>{payout.business.name}</bdi>
                    </p>
                    <p className="text-sm text-muted">
                      {tPayouts(`methods.${payout.method}`)}
                      {payout.decidedAt && ` · ${day(payout.decidedAt)}`}
                      {payout.reference && (
                        <>
                          {" · "}
                          <bdi dir="ltr">{payout.reference}</bdi>
                        </>
                      )}
                    </p>
                  </div>
                  <Pill>{t(`status.${payout.status}`)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
