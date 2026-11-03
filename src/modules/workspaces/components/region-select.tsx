"use client";

import { useTranslations } from "next-intl";
import { inputClass, LabeledControl } from "@/components/ui/field";
import { REGION_KEYS } from "@/config/regions";

/**
 * Which part of Lebanon the place is in, so guests searching for a region find it. Left on "From the town", it is
 * worked out from the town typed above ("Ehden" → North Lebanon).
 */
export function RegionSelect({ defaultValue }: { defaultValue: string | null }) {
  const t = useTranslations("regions");
  return (
    <LabeledControl label={t("label")} hint={t("hint")}>
      <select name="region" defaultValue={defaultValue ?? ""} className={inputClass}>
        <option value="">{t("fromTown")}</option>
        {REGION_KEYS.map((key) => (
          <option key={key} value={key}>
            {t(`names.${key}`)}
          </option>
        ))}
      </select>
    </LabeledControl>
  );
}
