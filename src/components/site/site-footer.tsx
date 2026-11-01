import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { BRAND } from "@/config/brand";
import { Wordmark } from "./wordmark";

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="text-muted transition-colors hover:text-ink" href={href}>
      {children}
    </Link>
  );
}

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="mt-24 border-t border-line bg-surface-2">
      <div className="mx-auto grid max-w-360 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-4 text-sm leading-relaxed text-muted">{t("about")}</p>
        </div>
        <div className="grid content-start gap-2.5 text-sm">
          <p className="font-semibold">{t("guests")}</p>
          <FooterLink href="/search">{t("explore")}</FooterLink>
          <FooterLink href="/account">{t("trips")}</FooterLink>
          <FooterLink href="/assistant">{t("assistant")}</FooterLink>
        </div>
        <div className="grid content-start gap-2.5 text-sm">
          <p className="font-semibold">{t("hosts")}</p>
          <FooterLink href="/host">{t("listPlace")}</FooterLink>
          <FooterLink href="/pricing">{t("pricing")}</FooterLink>
          <FooterLink href="/dashboard">{t("dashboard")}</FooterLink>
          <FooterLink href="/privacy">{t("privacy")}</FooterLink>
        </div>
      </div>
      <div className="mx-auto flex max-w-360 flex-wrap items-center justify-between gap-3 px-4 pb-10 text-xs text-faint sm:px-6 lg:px-10">
        <span>
          © {new Date().getFullYear()} {BRAND.name} · {BRAND.nameAr}
        </span>
        <span>{t("madeIn")}</span>
      </div>
    </footer>
  );
}
