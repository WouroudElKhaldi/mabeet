"use client";

import { clsx } from "clsx";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { shiftDay } from "../calendar-model";

/** Nights being closed on the calendar: the first and last night (both closed), until the last one is picked. */
export interface BlockDraft {
  start: string;
  end: string | null;
  roomId: string;
}

/**
 * Closes a run of nights in one room: for maintenance, or a booking taken by phone. The nights come from the calendar
 * (a double-click, then a click on the last night) and can be adjusted here before saving.
 */
export function CloseDatesForm({
  businessId,
  draft,
  rooms,
  formatDay,
  onChange,
  onClose,
}: {
  businessId: string;
  draft: BlockDraft;
  rooms: Array<{ id: string; name: string }>;
  formatDay: (iso: string) => string;
  onChange: (draft: BlockDraft) => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard.calendar");
  const { run, pending, error } = useAction();
  const [note, setNote] = useState("");

  const save = async () => {
    const { end, roomId } = draft;
    if (!end || !roomId) return;
    const saved = await run(() =>
      api.post(`/api/workspaces/${businessId}/blocks`, {
        roomId,
        checkIn: draft.start,
        // The form picks the last night; the stay ends the morning after it.
        checkOut: shiftDay(end, 1),
        note: note.trim() || null,
      }),
    );
    if (saved) onClose();
  };

  return (
    // Laid out by its own width, not the screen's: beside the calendar's side column a wide screen still leaves it
    // narrow, and four fields in a row there cut off the room's name and the dates.
    <div className="@container min-w-0 rounded-xl bg-surface p-5 ring-1 ring-accent">
      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @4xl:grid-cols-4 @4xl:items-end">
        <p className="col-span-full flex items-center gap-2 font-semibold">
          <Lock className="size-4 text-accent" aria-hidden />
          {draft.end === null
            ? t("pickLastNight")
            : t("closeRange", { from: formatDay(draft.start), to: formatDay(draft.end) })}
        </p>
        <label className="grid gap-1 text-xs font-semibold">
          {t("room")}
          <select
            value={draft.roomId}
            onChange={(event) => onChange({ ...draft, roomId: event.target.value })}
            className={clsx(inputClass, "h-10")}
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("from")}
          <input
            type="date"
            value={draft.start}
            onChange={(event) => event.target.value && onChange({ ...draft, start: event.target.value })}
            className={clsx(inputClass, "h-10")}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("lastNight")}
          <input
            type="date"
            value={draft.end ?? draft.start}
            min={draft.start}
            onChange={(event) => event.target.value && onChange({ ...draft, end: event.target.value })}
            className={clsx(inputClass, "h-10")}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("note")}
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            placeholder={t("notePlaceholder")}
            className={clsx(inputClass, "h-10")}
          />
        </label>
        <div className="col-span-full flex flex-wrap gap-2">
          <Button disabled={pending || draft.end === null} onClick={() => void save()}>
            {t("block")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
        <FormError message={error} className="col-span-full" />
      </div>
    </div>
  );
}
