import { LayoutDashboard, LogIn } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import type { NavGroup } from "@/components/shell/nav";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { BRAND } from "@/config/brand";
import { listWorkspaces } from "@/modules/team/server";
import { getCurrentUser } from "@/server/http/session";
import { HeaderShell } from "./header-shell";
import { NavLink } from "./nav-link";
import { SiteMenu } from "./site-menu";
import { Wordmark } from "./wordmark";

export async function SiteHeader() {
  const [t, footer, user] = await Promise.all([
    getTranslations("nav"),
    getTranslations("footer"),
    getCurrentUser(),
  ]);
  // Anyone who works in a place (owner, admin or staff) gets a way back to it; /dashboard opens the one place, or
  // all of them side by side.
  const worksInAPlace = user ? (await listWorkspaces(user.id)).length > 0 : false;
  // Below xl (1280px) the links make way for a menu, grouped like the footer.
  const phoneNav: NavGroup[] = [
    {
      label: footer("guests"),
      items: [
        { href: "/search", label: t("explore"), icon: "explore" },
        { href: "/assistant", label: t("assistant"), icon: "assistant" },
      ],
    },
    {
      label: footer("hosts"),
      items: [
        worksInAPlace
          ? { href: "/dashboard", label: t("dashboard"), icon: "overview" }
          : { href: "/host", label: t("host"), icon: "place" },
        { href: "/pricing", label: t("pricing"), icon: "pricing" },
      ],
    },
    {
      label: BRAND.name,
      items: [
        { href: "/about", label: footer("aboutUs"), icon: "about" },
        { href: "/contact", label: footer("contact"), icon: "contact" },
      ],
    },
  ];
  return (
    <HeaderShell>
      <div className="mx-auto flex h-20 max-w-360 items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Wordmark />
        <nav className="ms-10 hidden items-center gap-1 text-[0.9375rem] font-semibold xl:flex">
          <NavLink href="/search">{t("explore")}</NavLink>
          <NavLink href="/assistant">{t("assistant")}</NavLink>
          <NavLink href="/pricing">{t("pricing")}</NavLink>
          <NavLink href="/about">{footer("aboutUs")}</NavLink>
          <NavLink href="/contact">{footer("contact")}</NavLink>
        </nav>
        <div className="ms-auto flex items-center gap-1">
          {worksInAPlace ? (
            <NavLink href="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
              <LayoutDashboard aria-hidden className="size-4" />
              <span className="sr-only sm:not-sr-only">{t("dashboard")}</span>
            </NavLink>
          ) : (
            <NavLink href="/host" className="hidden text-sm font-semibold sm:block">
              {t("host")}
            </NavLink>
          )}
          <div className="hidden xl:block">
            <AppearanceMenu />
          </div>
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
              className={`${slideParent} ms-1 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-opacity hover:opacity-90`}
            >
              <SlideLabel icon={LogIn} flipInRtl>
                {t("signIn")}
              </SlideLabel>
            </Link>
          )}
          <SiteMenu nav={phoneNav} title={t("menu")} />
        </div>
      </div>
    </HeaderShell>
  );
}
