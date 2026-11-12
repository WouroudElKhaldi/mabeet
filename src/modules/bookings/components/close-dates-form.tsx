"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { SheetDialog } from "@/components/ui/sheet-dialog";
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
 * (a double-click, then a click on the last night): while the last night is still to pick, one line under the calendar
 * says so and the calendar stays free to click. Once it is picked, the form opens in a pop-up, where the room, the
 * nights and a note can still be changed before saving.
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

  if (draft.end === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-5 py-3 ring-1 ring-accent">
        <p className="flex items-center gap-2 font-semibold">
          <Lock className="size-4 text-accent" aria-hidden />
          {t("pickLastNight")}
        </p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
    );
  }

  return (
    <SheetDialog
      open
      onClose={onClose}
      title={t("closeRange", { from: formatDay(draft.start), to: formatDay(draft.end) })}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => void save()}>
            {t("block")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold sm:col-span-2">
          {t("room")}
          <select
            value={draft.roomId}
            onChange={(event) => onChange({ ...draft, roomId: event.target.value })}
            className={inputClass}
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
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("lastNight")}
          <input
            type="date"
            value={draft.end}
            min={draft.start}
            onChange={(event) => event.target.value && onChange({ ...draft, end: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold sm:col-span-2">
          {t("note")}
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            placeholder={t("notePlaceholder")}
            className={inputClass}
          />
        </label>
        <FormError message={error} className="sm:col-span-2" />
      </div>
    </SheetDialog>
  );
}
