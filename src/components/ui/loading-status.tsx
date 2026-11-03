import clsx from "clsx";
import { useTranslations } from "next-intl";

/** "Loading…" for screen readers, which cannot see a shimmer. `visible` shows it for everyone, for slow parts. */
export function LoadingStatus({ visible = false }: { visible?: boolean }) {
  const t = useTranslations("common");
  return (
    <p role="status" className={clsx(visible ? "text-sm text-muted" : "sr-only")}>
      {t("loading")}
    </p>
  );
}
