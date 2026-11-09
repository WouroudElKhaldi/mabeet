import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

const pill = "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ring-line";

/** Newer and older links and "Page x of y", as plain links so each page has its own address. Nothing for one page. */
export async function Pagination({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
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
          {t("newer")}
        </>,
      )}
      <p className="text-sm text-muted">{t("of", { page, pages })}</p>
      {link(
        page + 1,
        page < pages,
        <>
          {t("older")}
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </>,
      )}
    </nav>
  );
}
