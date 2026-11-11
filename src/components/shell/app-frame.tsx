"use client";

import clsx from "clsx";
import { ExternalLink, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/site/wordmark";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { SignOutButton } from "@/modules/accounts";
import { BackLink } from "./back-link";
import { currentNavItem, isActiveNav, tabItems } from "./nav";
import type { NavGroup } from "./nav";
import { NAV_ICONS } from "./nav-icons";
import { NavLinks } from "./nav-links";
import { PlaceSwitcher, type SwitcherPlace } from "./place-switcher";

interface AppFrameProps {
  nav: NavGroup[];
  /** "Host" or "Admin". */
  areaLabel: string;
  /** Shown next to the area when a platform admin is in someone else's business. */
  badge?: string;
  viewSiteHref: string;
  userName: string;
  /** The notification bell, built by the layout for this person. */
  bell?: ReactNode;
  /** In a place's dashboard: that place and every place this person works in, to switch between them. */
  places?: { current: SwitcherPlace; all: SwitcherPlace[] };
  children: ReactNode;
}

function Avatar({ name, label }: { name: string; label?: string }) {
  return (
    <span
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** The parts of the dashboard frame that move: the phone drawer, the bar at the bottom, the page name in the top bar. */
export function AppFrame({
  nav,
  areaLabel,
  badge,
  viewSiteHref,
  userName,
  bell,
  places,
  children,
}: AppFrameProps) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const page = currentNavItem(nav, pathname);
  const tabs = tabItems(nav);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-e border-line bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
          <Wordmark />
        </div>
        <div className="flex flex-col gap-5 p-4">
          {places ? <PlaceSwitcher current={places.current} places={places.all} /> : null}
          <NavLinks nav={nav} label={t("tabs")} />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-paper/85 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
          <Button
            variant="ghost"
            size="icon"
            className="-ms-2 lg:hidden"
            aria-label={t("menu")}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="shrink-0 font-semibold text-muted">{areaLabel}</span>
            {badge ? (
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                {badge}
              </span>
            ) : null}
            {page ? (
              <>
                <span aria-hidden className="text-faint">
                  /
                </span>
                <span className="truncate font-semibold">{page.label}</span>
              </>
            ) : null}
          </p>
          <Link
            href={viewSiteHref}
            className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-surface-2 sm:inline-flex"
          >
            {t("viewSite")}
            <ExternalLink className="size-4" aria-hidden />
          </Link>
          {bell}
          <AppearanceMenu />
          <div className="hidden items-center gap-1 lg:flex">
            <Avatar name={userName} label={t("account")} />
            <SignOutButton />
          </div>
        </header>

        <main
          className={clsx(
            "mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10",
            tabs.length > 0 && "pb-24 lg:pb-10",
          )}
        >
          <BackLink className="mb-4" />
          {children}
        </main>
      </div>

      {/* A menu with no tab pages (all of someone's places) would leave the bar holding "More" alone, which the menu
          button in the top bar already opens. */}
      {tabs.length > 0 ? (
        <nav
          aria-label={t("tabs")}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        >
          <ul className="grid auto-cols-fr grid-flow-col">
            {tabs.map((item) => {
              const active = isActiveNav(pathname, item);
              const Icon = NAV_ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold",
                      active ? "text-accent" : "text-muted",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    <span className="max-w-full truncate px-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setMenuOpen(true)}
                className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold text-muted"
              >
                <Menu className="size-5" aria-hidden />
                {t("more")}
              </button>
            </li>
          </ul>
        </nav>
      ) : null}

      <SheetDialog
        placement="start"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={areaLabel}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={userName} />
              <span className="truncate text-sm font-semibold">{userName}</span>
            </span>
            <SignOutButton />
          </div>
        }
      >
        {places ? (
          <div className="mb-5">
            <PlaceSwitcher
              current={places.current}
              places={places.all}
              onNavigate={() => setMenuOpen(false)}
            />
          </div>
        ) : null}
        <NavLinks nav={nav} label={t("tabs")} onNavigate={() => setMenuOpen(false)} />
        <Link
          href={viewSiteHref}
          onClick={() => setMenuOpen(false)}
          className="mt-6 flex h-11 items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ExternalLink className="size-5 shrink-0" aria-hidden />
          {t("viewSite")}
        </Link>
      </SheetDialog>
    </div>
  );
}
