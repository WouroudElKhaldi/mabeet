"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { choiceChipClass, Field, labelledControlClass, inputClass, TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { AMENITIES } from "@/config/amenities";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { uploadPhotos } from "./photo-manager";

export interface EditableRoom {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  baseRateCents: number;
  minNights: number;
  amenities: string[];
  active: boolean;
}

const NUMBER_FIELDS = ["capacity", "bedrooms", "beds", "bathrooms", "minNights"] as const;

/**
 * Adds a room when `room` is absent (its photos can be chosen right away), and edits it otherwise. When the place is
 * booked as a whole, rooms are only shown, never booked, so "bookable" reads "show on my listing". The same form
 * edits the whole-place unit itself (`unit`).
 */
export function RoomEditor({
  businessId,
  room,
  canEdit,
  wholePlace = false,
  unit = false,
}: {
  businessId: string;
  room?: EditableRoom;
  canEdit: boolean;
  wholePlace?: boolean;
  unit?: boolean;
}) {
  const t = useTranslations("dashboard.rooms");
  const tAmenity = useTranslations("placePage.amenity");
  const files = useRef<HTMLInputElement>(null);
  const { run, pending, error } = useAction();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: String(data.get("name")),
      description: String(data.get("description") ?? "") || null,
      baseRateCents: Math.round(Number(data.get("rate")) * 100),
      amenities: data.getAll("amenities"),
      ...Object.fromEntries(NUMBER_FIELDS.map((field) => [field, Number(data.get(field))])),
      active: data.get("active") === "on",
    };
    const photos = [...(files.current?.files ?? [])];
    const saved = await run(async () => {
      if (room) return api.patch(`/api/workspaces/${businessId}/rooms/${room.id}`, body);
      const created = await api.post<{ id: string }>(`/api/workspaces/${businessId}/rooms`, body);
      if (photos.length > 0) await uploadPhotos(businessId, photos, created.id);
      return created;
    });
    if (saved && !room) form.reset();
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4">
      {/* One column that never grows past the card: an input's own width (about 20 characters, two to a row for the
          sizes) would otherwise hold the form wider than a phone. */}
      <fieldset disabled={!canEdit || pending} className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Field label={t("name")} name="name" required maxLength={80} defaultValue={room?.name} />
          <Field
            label={t("rate")}
            name="rate"
            type="number"
            min={0}
            step={1}
            required
            inputMode="decimal"
            defaultValue={room ? room.baseRateCents / 100 : undefined}
          />
        </div>
        <TextArea
          label={t("description")}
          name="description"
          maxLength={4000}
          defaultValue={room?.description ?? ""}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {NUMBER_FIELDS.map((field) => (
            <label key={field} className={labelledControlClass}>
              {t(field)}
              <input
                name={field}
                type="number"
                min={field === "capacity" || field === "minNights" ? 1 : 0}
                max={60}
                required
                defaultValue={room?.[field] ?? (field === "capacity" ? 2 : 1)}
                className={`${inputClass} h-11`}
              />
            </label>
          ))}
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("amenities")}</legend>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((amenity) => (
              <label key={amenity} className={choiceChipClass}>
                <input
                  type="checkbox"
                  name="amenities"
                  value={amenity}
                  defaultChecked={room?.amenities.includes(amenity)}
                  className="sr-only"
                />
                {tAmenity(amenity)}
              </label>
            ))}
          </div>
        </fieldset>
        {!room && (
          <label className="grid gap-1.5 text-sm font-semibold">
            {t("photos")}
            <input
              ref={files}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="w-full text-sm font-normal contain-inline-size file:me-3 file:h-9 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:font-semibold file:text-paper"
            />
            <span className="text-xs font-normal text-muted">{t("photosHint")}</span>
          </label>
        )}
        <label className="flex items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="active"
            defaultChecked={room?.active ?? true}
            className="mt-0.5 size-4 accent-accent"
          />
          <span>
            {unit ? t("unitActive") : wholePlace ? t("showOnly") : t("active")}
            {wholePlace && !unit && (
              <span className="block text-xs font-normal text-muted">{t("showOnlyHint")}</span>
            )}
          </span>
        </label>
      </fieldset>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {room ? t("save") : t("create")}
          </Button>
          <FormError message={error} />
        </div>
      )}
    </form>
  );
}
