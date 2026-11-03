"use client";

import { clsx } from "clsx";
import { LogIn, LogOut, Moon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { panelClass } from "@/components/ui/field";
import type { OccupancyKind } from "@prisma/client";
import { nightsBetween } from "@/utils/stay-selection";
import { type CalendarEntry, covers, KIND_STYLE } from "../calendar-model";

type FormatDay = (iso: string, options: Intl.DateTimeFormatOptions) => string;

interface SidePanelProps {
  businessId: string;
  rooms: Array<{ id: string; name: string }>;
  entries: CalendarEntry[];
  comingUp: CalendarEntry[];
  today: string;
  selectedDay: string;
  /** Which kinds the filters show; hidden kinds are left out of the day's lists too. */
  layers: Record<OccupancyKind, boolean>;
  openEntry: CalendarEntry | null;
  canEditBlocks: boolean;
  busy: boolean;
  formatDay: FormatDay;
  onOpenEntry: (entry: CalendarEntry) => void;
  onCloseEntry: () => void;
  onRemoveBlock: (entry: CalendarEntry) => void;
  onCloseDates: (day: string, roomId: string) => void;
}

const UPCOMING_SHOWN = 6;

/** Beside the calendar: the chosen stay or the chosen day, then what is coming up this week. */
export function CalendarSidePanel(props: SidePanelProps) {
  const { rooms, comingUp, today, openEntry, formatDay, onOpenEntry } = props;
  const t = useTranslations("dashboard.calendar");
  const roomName = (id: string) => rooms.find((room) => room.id === id)?.name ?? "";
  const upcoming = comingUp
    .filter((entry) => entry.checkIn >= today && entry.kind !== "IMPORTED")
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .slice(0, UPCOMING_SHOWN);

  return (
    <aside className="grid content-start gap-4">
      {openEntry ? (
        <EntryDetails {...props} entry={openEntry} roomName={roomName} />
      ) : (
        <DaySummary {...props} roomName={roomName} />
      )}
      <div className={panelClass}>
        <h3 className="font-semibold">{t("comingUp")}</h3>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("nothingComing")}</p>
        ) : (
          <ul className="mt-2">
            {upcoming.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                icon={<LogIn className="size-3.5" aria-hidden />}
                detail={formatDay(entry.checkIn, { weekday: "short", day: "numeric" })}
                roomName={roomName}
                onOpen={onOpenEntry}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function EntryRow({
  entry,
  icon,
  detail,
  roomName,
  onOpen,
}: {
  entry: CalendarEntry;
  icon: ReactNode;
  detail?: string;
  roomName: (id: string) => string;
  onOpen: (entry: CalendarEntry) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-surface-2"
      >
        <span className={clsx("grid size-6 shrink-0 place-items-center rounded-md", KIND_STYLE[entry.kind])}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{entry.label}</span>
          <span className="block truncate text-xs text-muted">
            {roomName(entry.roomId)}
            {detail && ` · ${detail}`}
          </span>
        </span>
      </button>
    </li>
  );
}

function DetailRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={clsx("font-medium", mono && "font-mono")}>{children}</dd>
    </div>
  );
}

function EntryDetails({
  entry,
  businessId,
  canEditBlocks,
  busy,
  formatDay,
  roomName,
  onCloseEntry,
  onRemoveBlock,
}: SidePanelProps & { entry: CalendarEntry; roomName: (id: string) => string }) {
  const t = useTranslations("dashboard.calendar");
  const longDay = (iso: string) => formatDay(iso, { weekday: "short", day: "numeric", month: "short" });
  const removable = canEditBlocks && entry.kind === "MANUAL";
  return (
    <div className={panelClass}>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-muted">
          <span className={clsx("size-2.5 rounded-sm", KIND_STYLE[entry.kind])} aria-hidden />
          {t(`legend.${entry.kind}`)}
        </p>
        <button
          type="button"
          onClick={onCloseEntry}
          aria-label={t("close")}
          className="-me-1 -mt-1 grid size-8 place-items-center rounded-full hover:bg-surface-2"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <p className="mt-2 text-lg font-semibold">{entry.label}</p>
      <dl className="mt-3 grid gap-2 text-sm">
        <DetailRow label={t("room")}>{roomName(entry.roomId)}</DetailRow>
        <DetailRow label={t("arrives")}>{longDay(entry.checkIn)}</DetailRow>
        <DetailRow label={t("leaves")}>{longDay(entry.checkOut)}</DetailRow>
        <DetailRow label={t("length")}>
          {t("nights", { count: nightsBetween(entry.checkIn, entry.checkOut) })}
        </DetailRow>
        {entry.reference && (
          <DetailRow label={t("reference")} mono>
            {entry.reference}
          </DetailRow>
        )}
      </dl>
      {entry.pending && (
        <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
          {t("legend.pending")}
        </p>
      )}
      {entry.conflict && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {t("conflictHint")}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {entry.kind === "DIRECT" && (
          <ButtonLink size="sm" href={`/dashboard/${businessId}/bookings?tab=all`}>
            {t("openBooking")}
          </ButtonLink>
        )}
        {removable && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRemoveBlock(entry)}>
            {t("removeBlock")}
          </Button>
        )}
      </div>
    </div>
  );
}

function DayList({
  title,
  entries,
  icon,
  roomName,
  onOpen,
}: {
  title: string;
  entries: CalendarEntry[];
  icon: ReactNode;
  roomName: (id: string) => string;
  onOpen: (entry: CalendarEntry) => void;
}) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-bold tracking-wide text-faint uppercase">{title}</h3>
      {entries.length === 0 ? (
        <p className="px-2 text-sm text-faint">—</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} icon={icon} roomName={roomName} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DaySummary({
  rooms,
  entries,
  today,
  selectedDay,
  layers,
  canEditBlocks,
  formatDay,
  roomName,
  onOpenEntry,
  onCloseDates,
}: SidePanelProps & { roomName: (id: string) => string }) {
  const t = useTranslations("dashboard.calendar");
  const shown = entries.filter((entry) => layers[entry.kind]);
  const arrivals = shown.filter((entry) => entry.checkIn === selectedDay);
  const departures = shown.filter((entry) => entry.checkOut === selectedDay);
  const staying = shown.filter((entry) => covers(entry, selectedDay) && entry.checkIn !== selectedDay);
  // Free means free of everything, whatever the filters hide.
  const freeRooms = rooms.filter(
    (room) => !entries.some((entry) => entry.roomId === room.id && covers(entry, selectedDay)),
  );
  const listProps = { roomName, onOpen: onOpenEntry };
  return (
    <div className={panelClass}>
      <p className="text-xs font-semibold text-muted">
        {selectedDay === today ? t("today") : formatDay(selectedDay, { weekday: "long" })}
      </p>
      <p className="font-display text-xl font-semibold">
        {formatDay(selectedDay, { day: "numeric", month: "long", year: "numeric" })}
      </p>
      <div className="mt-4 grid gap-4">
        <DayList
          title={t("arrivals", { count: arrivals.length })}
          entries={arrivals}
          icon={<LogIn className="size-3.5" aria-hidden />}
          {...listProps}
        />
        <DayList
          title={t("departures", { count: departures.length })}
          entries={departures}
          icon={<LogOut className="size-3.5 rtl:rotate-180" aria-hidden />}
          {...listProps}
        />
        <DayList
          title={t("staying", { count: staying.length })}
          entries={staying}
          icon={<Moon className="size-3.5" aria-hidden />}
          {...listProps}
        />
        <section>
          <h3 className="mb-1 text-xs font-bold tracking-wide text-faint uppercase">
            {t("freeRooms", { count: freeRooms.length, total: rooms.length })}
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {freeRooms.map((room) => (
              <li key={room.id}>
                {canEditBlocks ? (
                  <button
                    type="button"
                    onClick={() => onCloseDates(selectedDay, room.id)}
                    title={t("closeDates")}
                    className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/20"
                  >
                    {room.name}
                  </button>
                ) : (
                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                    {room.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
