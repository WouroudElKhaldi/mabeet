"use client";

import { DoorOpen, Home } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCloseDialog } from "@/components/ui/form-dialog";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { BOOKING_UNITS } from "@/config/enums";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

type BookingUnit = (typeof BOOKING_UNITS)[number];

const UNIT_ICONS = { ROOMS: DoorOpen, WHOLE_PLACE: Home } as const;

/**
 * The place's description, and whether guests book its rooms one by one or the whole place at once. Choosing the
 * whole place gives it its whole-place unit (`PUT .../booking-unit`), which needs rooms.manage too. Edited in a pop-up
 * from its card on "Your place", which it closes once saved.
 */
export function PlaceEssentials({
  businessId,
  description,
  bookingUnit,
  canChooseUnit,
}: {
  businessId: string;
  description: string | null;
  bookingUnit: BookingUnit;
  canChooseUnit: boolean;
}) {
  const t = useTranslations("place");
  const { run, pending, error } = useAction();
  const [unit, setUnit] = useState<BookingUnit>(bookingUnit);
  const closeDialog = useCloseDialog();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const done = await run(async () => {
      await api.patch(`/api/workspaces/${businessId}/settings`, {
        description: String(data.get("description") ?? "").trim() || null,
      });
      if (unit !== bookingUnit)
        await api.put(`/api/workspaces/${businessId}/booking-unit`, { bookingUnit: unit });
    });
    if (done) closeDialog();
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-5">
      <TextArea
        label={t("description")}
        name="description"
        maxLength={4000}
        defaultValue={description ?? ""}
        placeholder={t("descriptionPlaceholder")}
        hint={t("descriptionHint")}
      />
      <ChoiceCards
        legend={t("howBook")}
        name="bookingUnit"
        value={unit}
        onChange={setUnit}
        disabled={!canChooseUnit}
        choices={BOOKING_UNITS.map((value) => ({
          value,
          title: t(`units.${value}.title`),
          body: t(`units.${value}.body`),
          icon: UNIT_ICONS[value],
        }))}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        <FormError message={error} />
      </div>
    </form>
  );
}
