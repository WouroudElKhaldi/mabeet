import { clsx } from "clsx";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/config/appearance";
import { formatMoney } from "@/utils/format";
import { Postmark } from "./postmark";

// The case for booking direct, as two till receipts for the same three nights: one through a booking site, one on
// Mabeet. The example rates are typical of the big platforms; the point is the difference.
const NIGHTS = 3;
const RATE_CENTS = 10_000;
const GUEST_FEE = 0.14;
const HOST_COMMISSION = 0.15;

interface Line {
  label: string;
  cents: number;
  /** A charge that only exists because of the platform. */
  fee?: boolean;
}

function Receipt({
  title,
  lines,
  totals,
  locale,
  direct,
}: {
  title: string;
  lines: Line[];
  totals: Line[];
  locale: Locale;
  direct?: boolean;
}) {
  const money = (cents: number) => formatMoney(cents, "USD", locale);
  return (
    <div
      className={clsx(
        "relative drop-shadow-[0_18px_28px_rgb(0_0_0/0.14)]",
        direct ? "z-10 -rotate-1 sm:mt-10" : "rotate-1 opacity-90",
      )}
    >
      <div className="receipt bg-surface px-6 pt-6 pb-9 font-mono text-[0.8125rem] text-ink">
        <p
          className={clsx(
            "text-center text-[0.6875rem] font-bold tracking-[0.18em] uppercase",
            direct ? "text-accent" : "text-muted",
          )}
        >
          {title}
        </p>
        <div className="my-4 border-t border-dashed border-line-strong" />
        <dl className="grid gap-2">
          {lines.map((line) => (
            <div key={line.label} className="flex justify-between gap-4">
              <dt className={clsx(line.fee && !direct && "text-danger")}>{line.label}</dt>
              <dd className={clsx("tabular-nums", line.fee && !direct && "text-danger")}>
                {line.fee && line.cents > 0 ? "+" : ""}
                {money(line.cents)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="my-4 border-t border-dashed border-line-strong" />
        <dl className="grid gap-2">
          {totals.map((line) => (
            <div key={line.label} className="flex justify-between gap-4 font-bold">
              <dt>{line.label}</dt>
              <dd className={clsx("tabular-nums", line.fee && !direct && "text-danger")}>
                {money(line.cents)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {direct && <Postmark className="absolute -end-1 -top-9 size-20 rotate-12 sm:-end-6" />}
    </div>
  );
}

/** "Booking direct is simpler than you think": the three promises, then the receipts that prove the first. */
export async function DirectReceipts() {
  const [t, locale] = await Promise.all([getTranslations("home"), getLocale()]);
  const room = RATE_CENTS * NIGHTS;
  const guestFee = Math.round(room * GUEST_FEE);
  const commission = Math.round(room * HOST_COMMISSION);
  const steps = (["noFees", "held", "pay"] as const).map((key) => ({
    key,
    title: t(`steps.${key}.title`),
    body: t(`steps.${key}.body`),
  }));

  return (
    <section className="mx-auto mt-24 max-w-360 overflow-x-clip px-4 sm:px-6 lg:px-10">
      <div className="grid items-center gap-14 lg:grid-cols-[1fr_minmax(0,34rem)] lg:gap-20">
        <div>
          <h2 className="font-poster text-[clamp(1.75rem,3vw,2.5rem)]">
            {t.rich("directTitle", { em: (chunk) => <em>{chunk}</em> })}
          </h2>
          <p className="mt-4 max-w-lg leading-relaxed text-muted">{t("directBody")}</p>
          <ol className="mt-10 grid border-t border-line">
            {steps.map((step, index) => (
              <li key={step.key} className="grid grid-cols-[3.5rem_1fr] gap-4 border-b border-line py-5">
                <span className="font-poster text-3xl leading-none text-accent tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block font-semibold">{step.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <figure>
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
            <Receipt
              title={t("receipts.platform")}
              locale={locale as Locale}
              lines={[
                { label: t("receipts.room", { nights: NIGHTS }), cents: room },
                { label: t("receipts.guestFee"), cents: guestFee, fee: true },
              ]}
              totals={[
                { label: t("receipts.youPay"), cents: room + guestFee },
                { label: t("receipts.hostKeeps"), cents: room - commission, fee: true },
              ]}
            />
            <Receipt
              direct
              title={t("receipts.direct")}
              locale={locale as Locale}
              lines={[
                { label: t("receipts.room", { nights: NIGHTS }), cents: room },
                { label: t("receipts.platformFee"), cents: 0, fee: true },
              ]}
              totals={[
                { label: t("receipts.youPay"), cents: room },
                { label: t("receipts.hostKeeps"), cents: room },
              ]}
            />
          </div>
          <figcaption className="mt-10 text-xs text-muted">
            {t("receipts.note", {
              rate: formatMoney(RATE_CENTS, "USD", locale as Locale),
              fee: `${Math.round(GUEST_FEE * 100)}%`,
              commission: `${Math.round(HOST_COMMISSION * 100)}%`,
            })}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
