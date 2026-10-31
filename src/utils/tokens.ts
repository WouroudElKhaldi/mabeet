import { randomBytes } from "node:crypto";

export const REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

/** Unguessable token for public URLs (confirmation pages, iCal exports). */
export function secureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Short human-friendly booking reference, e.g. "MB-7KX3P9". */
export function bookingReference(): string {
  const code = Array.from(
    randomBytes(6),
    (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length],
  ).join("");
  return `MB-${code}`;
}
