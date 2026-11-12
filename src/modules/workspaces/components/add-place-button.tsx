"use client";

import { useTranslations } from "next-intl";
import { FormDialog } from "@/components/ui/form-dialog";
import { NewPlaceForm } from "./new-place-form";

/** "Add a place" on the "All my places" page: the new place's name and town in a pop-up. */
export function AddPlaceButton() {
  const t = useTranslations("shell");
  return (
    <FormDialog label={t("addPlace")} title={t("addPlace")} variant="secondary">
      <NewPlaceForm />
    </FormDialog>
  );
}
