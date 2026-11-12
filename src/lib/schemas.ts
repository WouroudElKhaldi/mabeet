import { z } from "zod";

// The input checks every module shares. A module's own checks live in its schemas.ts; reuse these pieces there
// instead of writing a new date, phone or money check.

export const id = z.string().min(1).max(64);

export const isoDate = z.iso.date();

/** A stay: the check-out night is free, so check-out must come after check-in. */
export const stayDates = z
  .object({ checkIn: isoDate, checkOut: isoDate })
  .refine(({ checkIn, checkOut }) => checkOut > checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });

/** International format, e.g. +96171123456. */
export const phone = z.string().regex(/^\+[1-9]\d{7,14}$/, "Use international format, e.g. +96171123456");

/**
 * Whole minor units (9999 is 99.99), never a fraction. LBP prices run to hundreds of millions of minor units, so the
 * only ceiling is the one a number holds exactly (`int()` refuses anything past it).
 */
export const cents = z.number().int().min(0);

/** The URL parts of a workspace route; every /api/workspaces/{businessId}/... route starts from these. */
export const workspaceParams = z.object({ businessId: id });

/**
 * A long list's address: the page and the words searched. A page reads it from its own address, so a wrong value
 * falls back instead of failing: a mistyped address still shows the list.
 */
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  q: z.string().trim().max(100).catch(""),
});

/** One of a list's choices in its address (`?status=SUSPENDED`), or none when it is missing or not one of them. */
export function listChoice<const Values extends readonly [string, ...string[]]>(values: Values) {
  return z.enum(values).optional().catch(undefined);
}
