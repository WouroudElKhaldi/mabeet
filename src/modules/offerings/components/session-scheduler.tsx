"use client";

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { choiceChipClass, inputClass, labelledControlClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import type { Locale } from "@/config/appearance";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { addDays, parseIsoDate, toIsoDate } from "@/utils/dates";
import { formatSessionTime } from "@/utils/format";
import { todayIn } from "@/utils/zoned-time";

export interface ScheduledSession {
  id: string;
  startsAt: string;
  capacity: number;
  seatsTaken: number;
}

/** Monday first, as a week is read in Lebanon; 0 is Sunday, as `getUTCDay` counts. */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
/** The most sessions one schedule adds; the server refuses more. */
const MAX_SESSIONS = 60;
/** How far the "until" date starts from today. */
const DEFAULT_WEEKS = 4;

/** Every date from `from` to `to` (both included) that falls on one of the weekdays picked, at most 60. */
function datesOn(from: string, to: string, weekdays: ReadonlySet<number>): string[] {
  const dates: string[] = [];
  for (
    let day = parseIsoDate(from);
    day <= parseIsoDate(to) && dates.length < MAX_SESSIONS;
    day = addDays(day, 1)
  ) {
    if (weekdays.has(day.getUTCDay())) dates.push(toIsoDate(day));
  }
  return dates;
}

/**
 * Schedules repeating sessions (every Saturday at 10:00 for a month), in the place's own time, and lists the
 * upcoming ones with the seats taken. A session with guests in it cannot be cancelled here: the guests' bookings are
 * cancelled first, from Bookings, so each of them is told and refunded.
 */
export function SessionScheduler({
  businessId,
  offeringId,
  defaultCapacity,
  timezone,
  sessions,
}: {
  businessId: string;
  offeringId: string;
  defaultCapacity: number;
  timezone: string;
  sessions: ScheduledSession[];
}) {
  const t = useTranslations("dashboard.offerings");
  const tConfirm = useTranslations("confirm.cancelSession");
  const locale = useLocale() as Locale;
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();
  const [note, setNote] = useState<string | null>(null);
  // Dates are the place's: "today" in Beirut, whatever the host's computer says.
  const today = todayIn(timezone);
  const until = toIsoDate(addDays(parseIsoDate(today), DEFAULT_WEEKS * 7));

  const schedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const weekdays = new Set(data.getAll("weekday").map(Number));
    const dates = datesOn(String(data.get("from")), String(data.get("to")), weekdays);
    if (dates.length === 0) {
      setNote(t("noDates"));
      return;
    }
    setNote(null);
    const added = await run(() =>
      api.post(`/api/workspaces/${businessId}/offerings/${offeringId}/sessions`, {
        dates,
        time: data.get("time"),
        capacity: Number(data.get("capacity")),
      }),
    );
    if (added) setNote(t("added", { count: dates.length }));
  };

  const cancel = async (sessionId: string) => {
    const answer = await confirm({
      title: tConfirm("title"),
      body: tConfirm("body"),
      confirmLabel: tConfirm("confirm"),
    });
    if (answer) await run(() => api.delete(`/api/workspaces/${businessId}/sessions/${sessionId}`));
  };

  return (
    <div className="grid gap-5">
      {dialog}
      <form onSubmit={(event) => void schedule(event)} className="grid gap-4 rounded-xl bg-surface-2 p-4">
        <p className="font-semibold">{t("schedule")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className={labelledControlClass}>
            {t("from")}
            <input
              name="from"
              type="date"
              required
              min={today}
              defaultValue={today}
              className={`${inputClass} h-11`}
            />
          </label>
          <label className={labelledControlClass}>
            {t("to")}
            <input
              name="to"
              type="date"
              required
              min={today}
              defaultValue={until}
              className={`${inputClass} h-11`}
            />
          </label>
          <label className={labelledControlClass}>
            {t("time")}
            <input name="time" type="time" required defaultValue="10:00" className={`${inputClass} h-11`} />
          </label>
          <label className={labelledControlClass}>
            {t("capacity")}
            <input
              name="capacity"
              type="number"
              min={1}
              max={500}
              required
              defaultValue={defaultCapacity}
              className={`${inputClass} h-11`}
            />
          </label>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-muted">{t("weekdays")}</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label key={day} className={choiceChipClass}>
                <input
                  type="checkbox"
                  name="weekday"
                  value={day}
                  defaultChecked={day === 6}
                  className="sr-only"
                />
                {t(`weekday.${day}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {t("addSessions")}
          </Button>
          {note && !error ? (
            <p role="status" className="text-sm text-muted">
              {note}
            </p>
          ) : null}
          <FormError message={error} />
        </div>
      </form>

      <div>
        <p className="mb-2 font-semibold">{t("upcoming")}</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">{t("noUpcoming")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-semibold">{formatSessionTime(session.startsAt, locale, timezone)}</span>
                <span className="flex items-center gap-3 text-muted">
                  <span className="tabular-nums">
                    {t("seats", { taken: session.seatsTaken, capacity: session.capacity })}
                  </span>
                  <button
                    type="button"
                    disabled={pending || session.seatsTaken > 0}
                    aria-label={t("cancelSession")}
                    title={t("cancelSession")}
                    onClick={() => void cancel(session.id)}
                    className="grid size-9 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
