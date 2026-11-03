import type { OccupancyKind } from "@prisma/client";
import { addDays, parseIsoDate, toIsoDate } from "@/utils/dates";

// The calendar screen's data and the pure date helpers its parts share (board, side panel, close-dates form). Dates
// are ISO text (YYYY-MM-DD), so they compare as text and render the same on the server and in the browser.

/** One taken run of nights on the calendar: a booking, closed dates, or a stay imported from a platform. */
export interface CalendarEntry {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  kind: OccupancyKind;
  /** The guest's name, the host's note, or where the stay came from. */
  label: string;
  /** A platform stay that overlaps one of ours. */
  conflict: boolean;
  /** Waiting for the host's answer or for the payment. */
  pending: boolean;
  /** A direct booking's reference. */
  reference: string | null;
}

export const ENTRY_KINDS = ["DIRECT", "MANUAL", "IMPORTED"] as const satisfies readonly OccupancyKind[];

export const KIND_STYLE: Record<OccupancyKind, string> = {
  DIRECT: "bg-accent text-accent-ink",
  MANUAL: "bg-ink/80 text-paper",
  IMPORTED: "bg-glow/25 text-ink ring-1 ring-inset ring-glow/60",
};

/** Diagonal stripes over a stay that still waits for the host or for payment. */
export const PENDING_STYLE =
  "[background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgb(255_255_255/0.22)_6px_12px)]";

export const shiftDay = (iso: string, days: number) => toIsoDate(addDays(parseIsoDate(iso), days));

/** The night starting on `day` is part of the stay; the check-out day is free again. */
export const covers = (entry: CalendarEntry, day: string) => entry.checkIn <= day && day < entry.checkOut;

export const isWeekend = (day: string) => [0, 6].includes(parseIsoDate(day).getUTCDay());

/** Stacks stays into lanes, so a stay keeps its row from one day to the next. */
export function assignLanes(entries: CalendarEntry[]): Map<string, number> {
  const ends: string[] = [];
  const lanes = new Map<string, number>();
  for (const entry of [...entries].sort(
    (a, b) => a.checkIn.localeCompare(b.checkIn) || b.checkOut.localeCompare(a.checkOut),
  )) {
    let lane = ends.findIndex((end) => end <= entry.checkIn);
    if (lane === -1) lane = ends.push(entry.checkOut) - 1;
    else ends[lane] = entry.checkOut;
    lanes.set(entry.id, lane);
  }
  return lanes;
}
