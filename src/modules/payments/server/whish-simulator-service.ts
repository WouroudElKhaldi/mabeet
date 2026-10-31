import { randomBytes } from "node:crypto";
import type { z } from "zod";
import { prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { notFound } from "@/server/errors";
import type { whishCreateBody } from "../schemas";
import * as simulator from "./whish-simulator-repository";

// A stand-in for Whish Pay while Mabeet has no Whish keys (WHISH_MODE=simulator). It speaks the same API as
// Whish (v1.4.4), so the real client in src/modules/payments/server/whish.ts runs unchanged against it, and it follows
// Whish's sandbox rules: test phone 96170123456 and code 111111 pay; any other code is a failed attempt that
// leaves the link payable. Swap WHISH_MODE to "sandbox" once Whish issues keys.

const TEST_PHONE = "96170123456";
const TEST_OTP = "111111";
const WHISH_CURRENCIES = ["USD", "LBP"];
const CALLBACK_TIMEOUT_MS = 10_000;

/** Whish's response envelope. */
type Envelope = {
  status: boolean;
  code: string | null;
  dialog: null;
  actions: null;
  extra: null;
  data: unknown;
  retrieved?: boolean;
};
const ok = (data: unknown, retrieved?: boolean): Envelope => ({
  status: true,
  code: null,
  dialog: null,
  actions: null,
  extra: null,
  data,
  ...(retrieved === undefined ? {} : { retrieved }),
});
const fail = (code: string): Envelope => ({
  status: false,
  code,
  dialog: null,
  actions: null,
  extra: null,
  data: null,
});

/** With real Whish keys the simulator does not exist: its routes and page answer 404. */
function assertOn(): void {
  if (env.WHISH_MODE !== "simulator") throw notFound("Page");
}

/** Whish rejects requests without its headers; the simulator does too. */
export function hasWhishHeaders(headers: Headers): boolean {
  return Boolean(headers.get("channel") && headers.get("secret") && headers.get("websiteUrl"));
}

const payPageUrl = (code: string) => new URL(`/whish-simulator/pay/${code}`, env.BETTER_AUTH_URL).toString();

/**
 * The simulator only stands in for payments this site starts, so it only calls back and sends payers back to this
 * site. Any other address would let anyone make our server fetch a URL of their choosing, or turn the payment page
 * into a redirect to another website.
 */
const onThisSite = (url: string) => new URL(url).origin === new URL(env.BETTER_AUTH_URL).origin;

/** POST /payment/whish. Re-sending an externalId replays the first answer, as Whish does. */
export async function createSimulatedPayment(body: z.infer<typeof whishCreateBody>): Promise<Envelope> {
  assertOn();
  if (!WHISH_CURRENCIES.includes(body.currency)) return fail("currency.not_supported");
  const addresses = [
    body.successCallbackUrl,
    body.failureCallbackUrl,
    body.successRedirectUrl,
    body.failureRedirectUrl,
  ];
  if (!addresses.every(onThisSite)) return fail("url.not_allowed");
  const code = randomBytes(6).toString("base64url");
  const saved = await simulator.upsertSimulatedPayment(prisma, {
    externalId: body.externalId,
    code,
    amount: body.amount,
    currency: body.currency,
    invoice: body.invoice ?? null,
    successCallbackUrl: body.successCallbackUrl,
    failureCallbackUrl: body.failureCallbackUrl,
    successRedirectUrl: body.successRedirectUrl,
    failureRedirectUrl: body.failureRedirectUrl,
  });
  const retrieved = saved.code !== code;
  return ok({ collectUrl: payPageUrl(saved.code) }, retrieved || undefined);
}

/** POST /payment/collect/status */
export async function readSimulatedStatus(externalId: string): Promise<Envelope> {
  assertOn();
  const payment = await simulator.findSimulatedPayment(prisma, externalId);
  if (!payment) return fail("external_id.not_exists");
  return ok({ collectStatus: payment.status, payerPhoneNumber: payment.payerPhone });
}

/** POST /payment/whish/refund: only a successful payment, and only once (a repeat is "retrieved"). */
export async function refundSimulatedPayment(externalId: string): Promise<Envelope> {
  assertOn();
  const payment = await simulator.findSimulatedPayment(prisma, externalId);
  if (!payment) return fail("external_id.not_exists");
  if (payment.status === "refunded") return ok(null, true);
  if (!(await simulator.moveSimulatedPayment(prisma, externalId, "success", { status: "refunded" }))) {
    return fail("fail");
  }
  return ok(null, false);
}

/** Calls the merchant's callback by GET, as Whish does. Errors are logged: Whish doesn't retry either. */
async function callBack(url: string) {
  await fetch(url, { signal: AbortSignal.timeout(CALLBACK_TIMEOUT_MS) }).catch((error: unknown) =>
    console.error("[whish-simulator] callback failed", error),
  );
}

/**
 * The payer confirms on the payment page. The right phone and code pay it: the status becomes success and the
 * success callback fires. A wrong code fires the failure callback and leaves the link payable.
 */
export async function paySimulatedPayment(code: string, phone: string, otp: string) {
  assertOn();
  const payment = await simulator.findSimulatedPaymentByCode(prisma, code);
  if (!payment) throw notFound("Payment");
  if (payment.status !== "pending")
    return { ok: payment.status === "success", redirect: payment.successRedirectUrl };
  const digits = phone.replace(/\D/g, "");
  if (digits !== TEST_PHONE || otp !== TEST_OTP) {
    await callBack(payment.failureCallbackUrl);
    return { ok: false, redirect: null };
  }
  await simulator.moveSimulatedPayment(prisma, payment.externalId, "pending", {
    status: "success",
    payerPhone: digits,
  });
  await callBack(payment.successCallbackUrl);
  return { ok: true, redirect: payment.successRedirectUrl };
}
