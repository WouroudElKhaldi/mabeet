import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

const pill = "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ring-line";

/**
 * Back and forward links and "Page x of y", as plain links so each page has its own address. Nothing for one page.
 * A feed reads newest first ("Newer", "Older"); any other list reads "Previous", "Next".
 */
export async function Pagination({
  page,
  pages,
  href,
  order = "newest",
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  order?: "newest" | "list";
}) {
  if (pages <= 1) return null;
  const t = await getTranslations("pagination");
  const link = (target: number, enabled: boolean, children: ReactNode) =>
    enabled ? (
      <Link href={href(target)} className={clsx(pill, "hover:bg-surface-2")}>
        {children}
      </Link>
    ) : (
      <span aria-disabled className={clsx(pill, "text-faint")}>
        {children}
      </span>
    );
  return (
    <nav aria-label={t("label")} className="mt-6 flex items-center justify-between gap-3">
      {link(
        page - 1,
        page > 1,
        <>
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {order === "newest" ? t("newer") : t("previous")}
        </>,
      )}
      <p className="text-sm text-muted">{t("of", { page, pages })}</p>
      {link(
        page + 1,
        page < pages,
        <>
          {order === "newest" ? t("older") : t("next")}
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </>,
      )}
    </nav>
  );
}
