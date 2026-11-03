import { addDays, parseIsoDate, toIsoDate } from "./dates";

// The rules of choosing a stay on a calendar, apart from how the calendar looks. Days are ISO dates, which sort the
// same as the dates they name. A stay is nights [checkIn, checkOut): the check-out day itself is free, so a guest may
// leave on the morning a night is taken, and may arrive on the day the last guest leaves.

export interface StayDraft {
  checkIn: string | null;
  checkOut: string | null;
}

export interface StayRules {
  /** The first day that can be a check-in (today, for a guest). */
  minDate: string;
  /** The last day that can be a check-out. */
  maxDate: string;
  /** The nights somebody else has or the host closed. */
  taken: ReadonlySet<string>;
  minNights: number;
  maxNights?: number;
}

export type DayAvailability = "open" | "unavailable" | "outside";

export const EMPTY_STAY: StayDraft = { checkIn: null, checkOut: null };

export function isCompleteStay(draft: StayDraft): draft is { checkIn: string; checkOut: string } {
  return draft.checkIn !== null && draft.checkOut !== null;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((parseIsoDate(checkOut).getTime() - parseIsoDate(checkIn).getTime()) / 86_400_000);
}

export function isIsoDate(value: string | null): value is string {
  if (value === null) return false;
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

// Every night from `from` up to, not including, `to` is free.
function nightsAreFree(from: string, to: string, taken: ReadonlySet<string>): boolean {
  for (let day = parseIsoDate(from); toIsoDate(day) < to; day = addDays(day, 1)) {
    if (taken.has(toIsoDate(day))) return false;
  }
  return true;
}

/** Can a stay begin on this day? It needs a free night, and as many free nights after it as the minimum stay says. */
export function canStartAt(day: string, rules: StayRules): boolean {
  if (rules.maxNights !== undefined && rules.minNights > rules.maxNights) return false;
  if (day < rules.minDate) return false;
  const earliestCheckOut = toIsoDate(addDays(parseIsoDate(day), rules.minNights));
  return earliestCheckOut <= rules.maxDate && nightsAreFree(day, earliestCheckOut, rules.taken);
}

/** Can a stay that begins on `checkIn` end on `day`? Every night in between must be free; `day` itself may be taken. */
export function canEndAt(checkIn: string, day: string, rules: StayRules): boolean {
  if (day > rules.maxDate) return false;
  const nights = nightsBetween(checkIn, day);
  if (nights < rules.minNights) return false;
  if (rules.maxNights !== undefined && nights > rules.maxNights) return false;
  return nightsAreFree(checkIn, day, rules.taken);
}

/**
 * What a click on a day does. With a check-in waiting for its check-out, a later day that fits ends the stay; any
 * other day that can begin one starts again from there. A day that can do neither changes nothing.
 */
export function pickDay(draft: StayDraft, day: string, rules: StayRules): StayDraft {
  if (draft.checkIn !== null && draft.checkOut === null && day > draft.checkIn) {
    if (canEndAt(draft.checkIn, day, rules)) return { checkIn: draft.checkIn, checkOut: day };
  }
  return canStartAt(day, rules) ? { checkIn: day, checkOut: null } : draft;
}

/** How a day on the calendar looks and answers: can it be picked now, is it taken, or is it outside the calendar. */
export function dayAvailability(day: string, draft: StayDraft, rules: StayRules): DayAvailability {
  if (day < rules.minDate || day > rules.maxDate) return "outside";
  const endsTheStay =
    draft.checkIn !== null &&
    draft.checkOut === null &&
    day > draft.checkIn &&
    canEndAt(draft.checkIn, day, rules);
  return canStartAt(day, rules) || endsTheStay ? "open" : "unavailable";
}

/**
 * A stay that came from outside (a link, a saved search, the page before) cannot be trusted: it may be in the past,
 * back to front, over taken nights, or too short. Anything that does not fit becomes "no dates".
 */
export function sanitizeStay(draft: StayDraft, rules: StayRules): StayDraft {
  const { checkIn, checkOut } = draft;
  if (!isIsoDate(checkIn) || !canStartAt(checkIn, rules)) return EMPTY_STAY;
  if (checkOut === null) return { checkIn, checkOut: null };
  return isIsoDate(checkOut) && canEndAt(checkIn, checkOut, rules) ? { checkIn, checkOut } : EMPTY_STAY;
}
