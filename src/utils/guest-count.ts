/**
 * A number of guests that makes sense: a whole number from `min` up to `max`. Anything else (a number typed into the
 * address, an empty value, a room whose capacity just got smaller) becomes the nearest one that does.
 */
export function clampGuests(value: number, min: number, max: number): number {
  const upper = Math.max(max, min);
  if (!Number.isFinite(value)) return min;
  return Math.min(upper, Math.max(min, Math.trunc(value)));
}
