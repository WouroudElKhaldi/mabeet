"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { DEFAULT_TIME_ZONE } from "@/config/time";
import { isArabic } from "@/config/appearance";
import type { Locale } from "@/config/appearance";
import {
  monthStart,
  monthWeeks,
  moveFocus,
  sameMonth,
  shiftMonth,
  tabbableDay,
  weekDayDates,
} from "@/utils/calendar-grid";
import { addDays, parseIsoDate, toIsoDate } from "@/utils/dates";
import { formatDate } from "@/utils/format";
import { todayIn } from "@/utils/zoned-time";
import {
  EMPTY_STAY,
  canEndAt,
  dayAvailability,
  isCompleteStay,
  isIsoDate,
  nightsBetween,
  pickDay,
  sanitizeStay,
} from "@/utils/stay-selection";
import type { StayDraft, StayRules } from "@/utils/stay-selection";
import { Button } from "./button";
import { inputClass } from "./field";
import { SheetDialog } from "./sheet-dialog";

/** Check-in and check-out as ISO dates ("2026-11-14"), or null for "no dates yet". */
export type DateRangeValue = StayDraft;

const FAR_AHEAD_DAYS = 730;

interface DateRangePickerProps extends Omit<
  ComponentProps<"button">,
  "value" | "onChange" | "type" | "children" | "onClick" | "className"
> {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  /** Nights somebody else has booked or the host closed, as ISO dates. They cannot be slept, but can be left on. */
  takenNights?: readonly string[];
  minNights?: number;
  maxNights?: number;
  /** The last day that can be a check-out. By default two years from today. */
  maxDate?: string;
  /** The guesthouse's time zone, which decides what today is. */
  timeZone?: string;
}

interface Session {
  today: string;
  draft: StayDraft;
  /** The first day of the month on screen. */
  month: string;
}

const fullDate: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

// A stay that came from outside can hold dates that are not dates; the button only shows what it can read.
function shownDate(value: DateRangeValue, locale: Locale) {
  const { checkIn, checkOut } = value;
  if (!isIsoDate(checkIn)) return { checkIn: null, checkOut: null };
  const checkOutShown = isIsoDate(checkOut) && checkOut > checkIn ? checkOut : null;
  return {
    checkIn: formatDate(checkIn, locale),
    checkOut: checkOutShown ? formatDate(checkOutShown, locale) : null,
  };
}

/**
 * Check-in and check-out in one calendar. The button shows the two dates; it opens a dialog (a full-screen sheet on
 * phones) where the guest picks them. Nothing changes until "Apply", so closing the dialog cancels.
 */
export function DateRangePicker({
  value,
  onChange,
  takenNights,
  minNights = 1,
  maxNights,
  maxDate,
  timeZone = DEFAULT_TIME_ZONE,
  ...buttonProps
}: DateRangePickerProps) {
  const t = useTranslations("dates");
  const locale = useLocale() as Locale;
  const [session, setSession] = useState<Session | null>(null);

  const today = session?.today;
  const rules = useMemo<StayRules | null>(
    () =>
      today
        ? {
            minDate: today,
            maxDate: maxDate ?? toIsoDate(addDays(parseIsoDate(today), FAR_AHEAD_DAYS)),
            taken: new Set(takenNights),
            // A minimum below one night would allow a stay of no nights.
            minNights: Math.max(1, Math.floor(minNights)),
            maxNights,
          }
        : null,
    [today, maxDate, takenNights, minNights, maxNights],
  );

  function open() {
    const todayIso = todayIn(timeZone);
    const initialRules: StayRules = {
      minDate: todayIso,
      maxDate: maxDate ?? toIsoDate(addDays(parseIsoDate(todayIso), FAR_AHEAD_DAYS)),
      taken: new Set(takenNights),
      minNights: Math.max(1, Math.floor(minNights)),
      maxNights,
    };
    const draft = sanitizeStay(value, initialRules);
    setSession({ today: todayIso, draft, month: monthStart(draft.checkIn ?? todayIso) });
  }

  const close = () => setSession(null);
  const draft = session?.draft ?? EMPTY_STAY;
  // "Apply" saves a whole stay, or no dates at all; a check-in with no check-out is not an answer yet.
  const canApply = isCompleteStay(draft) || draft.checkIn === null;
  const shown = shownDate(value, locale);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={open}
        className={clsx(inputClass, "grid grid-cols-2 items-center text-start")}
        {...buttonProps}
      >
        <DateCell label={t("checkIn")} text={shown.checkIn} placeholder={t("addDate")} className="pe-3" />
        <DateCell
          label={t("checkOut")}
          text={shown.checkOut}
          placeholder={t("addDate")}
          className="border-s border-line ps-4"
        />
      </button>
      <SheetDialog
        open={session !== null}
        onClose={close}
        title={t("title")}
        footer={
          <>
            <Button
              variant="ghost"
              className="me-auto"
              aria-disabled={draft.checkIn === null}
              onClick={() =>
                draft.checkIn !== null &&
                setSession((current) => current && { ...current, draft: EMPTY_STAY })
              }
            >
              {t("clear")}
            </Button>
            <Button
              aria-disabled={!canApply}
              onClick={() => {
                if (!canApply) return;
                onChange(draft);
                close();
              }}
            >
              {t("apply")}
            </Button>
          </>
        }
      >
        {session && rules ? (
          <Calendar
            session={session}
            rules={rules}
            locale={locale}
            onDraft={(next) => setSession((current) => current && { ...current, draft: next })}
            onMonth={(month) => setSession((current) => current && { ...current, month })}
          />
        ) : null}
      </SheetDialog>
    </>
  );
}

function DateCell({
  label,
  text,
  placeholder,
  className,
}: {
  label: string;
  text: string | null;
  placeholder: string;
  className?: string;
}) {
  return (
    <span className={clsx("flex min-w-0 flex-col leading-tight", className)}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className={clsx("truncate text-sm font-semibold", text ? "text-ink" : "text-faint")}>
        {text ?? placeholder}
      </span>
    </span>
  );
}

interface CalendarProps {
  session: Session;
  rules: StayRules;
  locale: Locale;
  onDraft: (draft: StayDraft) => void;
  onMonth: (month: string) => void;
}

function Calendar({ session, rules, locale, onDraft, onMonth }: CalendarProps) {
  const t = useTranslations("dates");
  const { draft, month } = session;
  const headingId = useId();
  const gridRef = useRef<HTMLTableElement>(null);
  const [focusedDay, setFocusedDay] = useState<string | null>(draft.checkIn);
  const [hovered, setHovered] = useState<string | null>(null);
  // Only a key press moves the browser's focus; a click on "next month" must not steal it.
  const focusAfterRender = useRef(false);
  const rtl = isArabic(locale);

  const weeks = useMemo(() => monthWeeks(month), [month]);
  const weekDays = useMemo(
    () =>
      weekDayDates().map((date) => ({
        short: formatDate(date, locale, { weekday: "narrow" }),
        long: formatDate(date, locale, { weekday: "long" }),
      })),
    [locale],
  );
  // The spoken name of every day, made once per month: hovering repaints the grid again and again.
  const dayNames = useMemo(
    () =>
      new Map(
        weeks.flat().flatMap((day) => (day ? [[day, formatDate(day, locale, fullDate)] as const] : [])),
      ),
    [weeks, locale],
  );

  const tabDay = tabbableDay(month, focusedDay, rules.minDate);

  useEffect(() => {
    if (!focusAfterRender.current) return;
    focusAfterRender.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${focusedDay}"]`)?.focus();
  }, [focusedDay, month]);

  const { checkIn, checkOut } = draft;
  const previewEnd =
    checkIn !== null &&
    checkOut === null &&
    hovered !== null &&
    hovered > checkIn &&
    canEndAt(checkIn, hovered, rules)
      ? hovered
      : null;
  const rangeEnd = checkOut ?? previewEnd;

  const previousDisabled = month <= monthStart(rules.minDate);
  const nextDisabled = shiftMonth(month, 1) > rules.maxDate;

  function handleKey(event: React.KeyboardEvent, day: string) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = moveFocus(day, event.key, rtl);
    if (next === null) return;
    event.preventDefault();
    // The calendar stops at the month of today and the month of the last day it offers.
    if (monthStart(next) < monthStart(rules.minDate) || monthStart(next) > monthStart(rules.maxDate)) return;
    focusAfterRender.current = true;
    setFocusedDay(next);
    if (!sameMonth(next, month)) onMonth(monthStart(next));
  }

  const status = !checkIn
    ? t("chooseCheckIn")
    : !checkOut
      ? t("chooseCheckOut")
      : `${formatDate(checkIn, locale)} – ${formatDate(checkOut, locale)} · ${t("nights", { count: nightsBetween(checkIn, checkOut) })}`;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <p aria-live="polite" className="text-sm font-semibold text-ink">
        {status}
      </p>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("previousMonth")}
          aria-disabled={previousDisabled}
          onClick={() => !previousDisabled && onMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
        </Button>
        <h3 id={headingId} aria-live="polite" className="text-base font-semibold">
          {formatDate(month, locale, { month: "long", year: "numeric" })}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("nextMonth")}
          aria-disabled={nextDisabled}
          onClick={() => !nextDisabled && onMonth(shiftMonth(month, 1))}
        >
          <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
        </Button>
      </div>
      <table
        ref={gridRef}
        role="grid"
        aria-labelledby={headingId}
        className="w-full table-fixed border-collapse"
        onPointerLeave={() => setHovered(null)}
      >
        <thead>
          <tr>
            {weekDays.map((weekDay) => (
              <th
                key={weekDay.long}
                scope="col"
                abbr={weekDay.long}
                className="pb-2 text-xs font-semibold text-muted"
              >
                {weekDay.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, row) => (
            <tr key={row}>
              {week.map((day, column) => {
                if (day === null) return <td key={column} />;
                const availability = dayAvailability(day, draft, rules);
                const isStart = day === checkIn;
                const isEnd = day === checkOut;
                const inRange = checkIn !== null && rangeEnd !== null && day > checkIn && day <= rangeEnd;
                const name = [
                  dayNames.get(day),
                  isStart ? t("checkIn") : isEnd ? t("checkOut") : null,
                  availability === "open" ? null : t("unavailable"),
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <td key={day} role="gridcell" aria-selected={isStart || inRange} className="p-0 py-0.5">
                    <button
                      type="button"
                      data-day={day}
                      data-autofocus={day === tabDay ? "" : undefined}
                      tabIndex={day === tabDay ? 0 : -1}
                      aria-label={name}
                      aria-disabled={availability !== "open"}
                      className={dayClass({
                        availability,
                        isStart,
                        isEnd: isEnd || (day === previewEnd && !isEnd),
                        solidEnd: isEnd,
                        inRange: inRange && !isEnd && day !== previewEnd,
                        hasEnd: rangeEnd !== null,
                        isToday: day === session.today,
                        isTaken: rules.taken.has(day),
                      })}
                      onClick={() => {
                        setFocusedDay(day);
                        if (availability === "open") onDraft(pickDay(draft, day, rules));
                      }}
                      onKeyDown={(event) => handleKey(event, day)}
                      onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(day)}
                    >
                      {Number(day.slice(8))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rules.minNights > 1 ? (
        <p className="text-sm text-muted">{t("minStay", { count: rules.minNights })}</p>
      ) : null}
    </div>
  );
}

interface DayLook {
  availability: ReturnType<typeof dayAvailability>;
  isStart: boolean;
  isEnd: boolean;
  /** The check-out that was chosen, not one the pointer is only previewing. */
  solidEnd: boolean;
  inRange: boolean;
  hasEnd: boolean;
  isToday: boolean;
  /** Somebody has this night. A day that is only too short a gap before one is faint, not crossed out. */
  isTaken: boolean;
}

// The classes of one day. The two ends are solid and rounded on their outer side; the days between are a flat tinted
// band, so the stay reads as one bar. `start`/`end` are logical sides, so the bar runs the right way on an Arabic page.
function dayClass({ availability, isStart, isEnd, solidEnd, inRange, hasEnd, isToday, isTaken }: DayLook) {
  const solid = isStart || solidEnd;
  return clsx(
    "flex h-11 w-full items-center justify-center text-sm font-semibold tabular-nums outline-none",
    "focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ink",
    solid && "bg-accent text-accent-ink",
    !solid && (inRange || isEnd) && "bg-accent-soft text-ink",
    isStart && hasEnd && "rounded-s-full",
    isEnd && "rounded-e-full",
    isStart && !hasEnd && "rounded-full",
    !solid && !inRange && !isEnd && "rounded-full",
    !solid && !inRange && !isEnd && availability === "open" && "hover:bg-surface-2",
    availability !== "open" && !solid && "text-faint",
    availability === "unavailable" && isTaken && !solid && !inRange && "line-through",
    isToday && !solid && "ring-1 ring-inset ring-line-strong",
  );
}
