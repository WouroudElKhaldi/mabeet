import type { Metadata } from "next";
import localFont from "next/font/local";
import { getTranslations } from "next-intl/server";
import { BRAND } from "@/config/brand";
import { WhishSimulatorForm } from "@/modules/payments";
import { getPayPage } from "@/modules/payments/server";
import { findPageOr404 } from "@/server/http/page";

// Whish's own font. Only this page uses it, so only this page loads it.
const sourceSans = localFont({
  src: "../../../fonts/source-sans-400-700.woff2",
  variable: "--font-source-sans",
  weight: "400 700",
  display: "swap",
});

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("whishSim");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The simulated Whish Pay page (WHISH_MODE=simulator), standing in for Whish's own hosted page: its own page, outside
 * Mabeet's header and footer, in Whish's colours and font (`data-provider="whish"` in globals.css). The test-mode
 * banner stays, so it is never taken for the real thing.
 */
export default async function WhishSimulatorPage({ params }: PageProps) {
  const { code } = await params;
  const [t, payment] = await Promise.all([getTranslations("whishSim"), findPageOr404(getPayPage(code))]);
  return (
    <div data-provider="whish" className={`${sourceSans.variable} flex min-h-dvh flex-col`}>
      <header className="bg-accent text-accent-ink">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-5">
          <span className="text-[1.75rem] leading-none font-bold tracking-tight" dir="ltr">
            whish
          </span>
          <span className="rounded-full bg-accent-ink/15 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            {t("testMode")}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
        <div className="rise-in rounded-3xl bg-surface p-6 shadow-soft">
          <p className="text-sm font-semibold text-muted">{t("paying", { merchant: BRAND.name })}</p>
          <h1 className="mt-1 text-[2.25rem] leading-tight font-bold" dir="ltr">
            {payment.amount} <span className="text-xl font-semibold text-muted">{payment.currency}</span>
          </h1>
          {payment.invoice && <p className="mt-1 text-muted">{payment.invoice}</p>}
          <p className="mt-5 rounded-xl bg-accent-soft p-3 text-sm font-semibold text-ink">{t("banner")}</p>
          {payment.status === "pending" ? (
            <WhishSimulatorForm code={code} cancelUrl={payment.cancelUrl} />
          ) : (
            <p className="mt-6 text-muted">{t("closed")}</p>
          )}
        </div>
      </main>

      <footer className="pb-8 text-center text-xs font-semibold text-muted">{t("secured")}</footer>
    </div>
  );
}
