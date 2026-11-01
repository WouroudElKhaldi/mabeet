import { LogIn } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { getCurrentUser } from "@/server/http/session";
import { HeaderShell } from "./header-shell";
import { Wordmark } from "./wordmark";

export async function SiteHeader() {
  const [t, user] = await Promise.all([getTranslations("nav"), getCurrentUser()]);
  return (
    <HeaderShell>
      <div className="mx-auto flex h-20 max-w-360 items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Wordmark />
        <nav className="ms-10 hidden items-center gap-1 text-[0.9375rem] font-semibold md:flex">
          <Link href="/search" className="rounded-full px-4 py-2.5 transition-colors hover:bg-surface-2">
            {t("explore")}
          </Link>
          <Link href="/assistant" className="rounded-full px-4 py-2.5 transition-colors hover:bg-surface-2">
            {t("assistant")}
          </Link>
          <Link href="/pricing" className="rounded-full px-4 py-2.5 transition-colors hover:bg-surface-2">
            {t("pricing")}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <Link
            href="/host"
            className="hidden rounded-full px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-surface-2 sm:block"
          >
            {t("host")}
          </Link>
          <AppearanceMenu />
          {user ? (
            <Link
              href="/account"
              className="ms-1 flex h-11 items-center gap-2 rounded-full ps-1.5 pe-4 ring-1 ring-line-strong transition-shadow hover:shadow-soft"
            >
              <span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-32 truncate text-sm font-semibold sm:inline">
                {user.name.split(" ")[0]}
              </span>
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="ms-1 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
            >
              <LogIn className="size-4 rtl:rotate-180" aria-hidden />
              {t("signIn")}
            </Link>
          )}
        </div>
      </div>
    </HeaderShell>
  );
}
