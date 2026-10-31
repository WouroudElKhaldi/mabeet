import { z } from "zod";

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
