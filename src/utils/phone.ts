// Guests type a number the way they say it: "71 123 456", "03-123456", "0096171123456", "+961 71 123 456". The booking
// wants one form, international with a "+" and no spaces (+96171123456), so the host's WhatsApp link always works.

const LEBANON = "+961";

/**
 * The international form of a number as typed, assuming Lebanon when no country is given. It only tidies how the
 * number is written; whether it is a real number is for the booking's own check.
 *
 *   "71 123 456"        -> "+96171123456"   (no country: Lebanon)
 *   "03-123 456"        -> "+9613123456"    (the local leading 0 is dropped)
 *   "0096171123456"     -> "+96171123456"   (00 is the international prefix)
 *   "+44 20 7946 0958"  -> "+442079460958"  (another country is kept)
 */
export function normalizePhone(input: string): string {
  const kept = input.trim().replace(/[^\d+]/g, "");
  const plus = kept.startsWith("+");
  const digits = kept.replace(/\+/g, "");
  if (digits === "") return "";
  if (plus) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `${LEBANON}${digits.slice(1)}`;
  // Eight digits or fewer cannot carry a country code (Lebanese numbers have seven or eight): they are local.
  return digits.length <= 8 ? `${LEBANON}${digits}` : `+${digits}`;
}
