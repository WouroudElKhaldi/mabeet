import { z } from "zod";
import { CURRENCIES, DECIDED_PAYOUT_STATUSES, PAYOUT_METHODS } from "@/config/enums";
import { id, listChoice, listQuery, phone } from "@/lib/schemas";

// The simulated Whish server takes Whish's own request bodies.
export const whishCreateBody = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().max(3),
  invoice: z.string().max(300).optional(),
  externalId: z.string().min(1).max(64),
  successCallbackUrl: z.url(),
  failureCallbackUrl: z.url(),
  successRedirectUrl: z.url(),
  failureRedirectUrl: z.url(),
});
export const whishReferenceBody = z.object({
  currency: z.string().max(3),
  externalId: z.string().min(1).max(64),
  refundReason: z.string().max(300).optional(),
});
export const whishPayInput = z.object({
  phone: z.string().trim().min(6).max(20),
  otp: z.string().trim().min(4).max(8),
});
export const whishPayParams = z.object({ code: z.string().min(4).max(32) });

// ---------- Payouts ----------

export const payoutParams = z.object({ payoutId: id });

/** The admin's table of payout requests to send: words, a page, and how each is sent. */
export const payoutRequestsQuery = listQuery.extend({ method: listChoice(PAYOUT_METHODS) });

/** The admin's table of payouts already decided: the same, and whether each was sent or refused. */
export const payoutHistoryQuery = payoutRequestsQuery.extend({ status: listChoice(DECIDED_PAYOUT_STATUSES) });

/** A host asking for a payout: to a bank account (an IBAN, with the bank's name) or a Whish number. Never a card. */
export const payoutRequestInput = z
  .object({
    amountCents: z.number().int().min(100).max(100_000_000),
    currency: z.enum(CURRENCIES),
    method: z.enum(PAYOUT_METHODS),
    accountName: z.string().trim().min(2).max(120),
    bankName: z.string().trim().min(2).max(120).nullish(),
    // International Bank Account Number: a country code, two check digits, then up to 30 letters or digits.
    iban: z
      .string()
      .transform((value) => value.replace(/\s+/g, "").toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, "Enter a valid IBAN"))
      .nullish(),
    whishPhone: phone.nullish(),
  })
  .refine((input) => input.method !== "BANK_TRANSFER" || Boolean(input.iban && input.bankName), {
    message: "Bank transfers need the bank's name and an IBAN",
    path: ["iban"],
  })
  .refine((input) => input.method !== "WHISH" || Boolean(input.whishPhone), {
    message: "Whish payouts need the Whish phone number",
    path: ["whishPhone"],
  });

/** The admin sent a payout (with the transfer's reference) or refuses it (with a note the host sees). */
export const payoutDecisionInput = z.object({
  action: z.enum(["paid", "rejected"]),
  reference: z.string().trim().max(120).nullish(),
  note: z.string().trim().max(500).nullish(),
});
