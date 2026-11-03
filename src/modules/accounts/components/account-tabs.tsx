"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/** The account's pages that exist. Favourites and activity join as they are built. */
const TABS = [
  { key: "trips", href: "/account" },
  { key: "notifications", href: "/account/notifications" },
  { key: "privacy", href: "/account/privacy" },
] as const;

/** The account's sections as tabs, the current one underlined. */
export function AccountTabs() {
  const t = useTranslations("account.tabs");
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line" aria-label={t("label")}>
      {TABS.map(({ key, href }) => {
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative shrink-0 px-4 pb-3 text-sm font-semibold transition-colors",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {t(key)}
            {active && (
              <motion.span
                layoutId="account-tab"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
