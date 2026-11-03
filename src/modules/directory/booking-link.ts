import type { DateRangeValue } from "@/components/ui/date-range-picker";

/** The address of the book page for a stay: /p/{slug}/book?room=...&checkIn=...&checkOut=...&guests=... */
export function bookingHref(
  slug: string,
  stay: { roomId: string; guests: number; dates: DateRangeValue },
): string {
  const query = new URLSearchParams({ room: stay.roomId, guests: String(stay.guests) });
  if (stay.dates.checkIn) query.set("checkIn", stay.dates.checkIn);
  if (stay.dates.checkOut) query.set("checkOut", stay.dates.checkOut);
  return `/p/${encodeURIComponent(slug)}/book?${query.toString()}`;
}
