"use client";

import { useTranslations } from "next-intl";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { FormError } from "@/components/ui/form-error";
import { type Palette, PALETTES } from "@/config/appearance";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/**
 * The website's colour palette, for every visitor. Choosing one saves it and refreshes the page, so the admin sees it
 * at once on this very screen, in light or dark as their switch says.
 */
export function SitePalettePicker({ current }: { current: Palette }) {
  const t = useTranslations("admin.theme");
  const { run, pending, error } = useAction();
  return (
    <div className="grid gap-3">
      <ChoiceCards
        legend={t("title")}
        name="palette"
        columns={3}
        disabled={pending}
        value={current}
        onChange={(palette) => void run(() => api.patch("/api/admin/site", { palette }))}
        choices={PALETTES.map((palette) => ({
          value: palette,
          title: t(`palettes.${palette}`),
          body: t(`paletteNotes.${palette}`),
        }))}
      />
      <FormError message={error} />
    </div>
  );
}
