"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveNav } from "./nav";
import type { NavGroup } from "./nav";
import { NAV_ICONS } from "./nav-icons";

/** The menu: each group under its small title, the page being shown marked. Used by the side menu and the phone drawer. */
export function NavLinks({
  nav,
  label,
  onNavigate,
}: {
  nav: NavGroup[];
  /** What a screen reader calls this list of pages. */
  label: string;
  /** Called when a link is followed, so the phone drawer can close itself. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      {nav.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[0.6875rem] font-bold tracking-[0.12em] text-faint uppercase">
            {group.label}
          </p>
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = isActiveNav(pathname, item);
              const Icon = NAV_ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={clsx(
                      "flex h-11 items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-semibold transition-colors",
                      active ? "bg-accent-soft text-accent" : "text-ink hover:bg-surface-2",
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
