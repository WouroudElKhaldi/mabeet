"use client";

import { clsx } from "clsx";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { parentPath } from "@/utils/parent-path";

// The pages this tab has walked through on Mabeet since it loaded, so "Back" knows whether a page of ours lies behind
// this one. A browser Back or Forward steps along it instead of adding to it.
const visited: string[] = [];
let movingThroughHistory = false;

/** Follows the tab's pages. Mounted once, in the root layout, so it sees every page, even those without a Back. */
export function PageTrail() {
  const pathname = usePathname();
  useEffect(() => {
    const onPopState = () => {
      movingThroughHistory = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (visited.at(-1) === pathname) return;
    if (movingThroughHistory && visited.at(-2) === pathname) visited.pop();
    else visited.push(pathname);
    movingThroughHistory = false;
  }, [pathname]);
  return null;
}

/** Whether the page before this one in the tab is one of ours, so the browser's back stays on Mabeet. */
function cameFromMabeet() {
  if (visited.length > 1) return true;
  // The first page of this load: a page of ours may still lie behind it when it was opened by a full page load.
  if (window.history.length <= 1 || !document.referrer) return false;
  return new URL(document.referrer).origin === window.location.origin;
}

/**
 * "Back" to the page the person came from on Mabeet. When they arrived here from outside (a shared link, a new tab),
 * it goes to the page this one belongs to instead. Renders nothing on the home page and each area's home.
 */
export function BackLink({ className }: { className?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const parent = parentPath(usePathname());
  if (!parent) return null;
  return (
    <Link
      href={parent}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || !cameFromMabeet()) return;
        event.preventDefault();
        router.back();
      }}
      className={clsx(
        "inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-ink",
        className,
      )}
    >
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      {t("back")}
    </Link>
  );
}
