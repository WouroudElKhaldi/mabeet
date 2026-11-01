"use client";

import { clsx } from "clsx";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { parentPath } from "@/utils/parent-path";

/** "Back" to the page this one belongs to. Renders nothing on the home page and each area's home. */
export function BackLink({ className }: { className?: string }) {
  const t = useTranslations("common");
  const parent = parentPath(usePathname());
  if (!parent) return null;
  return (
    <Link
      href={parent}
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
