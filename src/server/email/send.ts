import { env } from "@/server/env";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export interface Email {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Where a reply goes, e.g. the guest who wrote from a Contact host page. */
  replyTo?: string;
  /** Lets Resend drop accidental duplicates, e.g. a retried request. */
  idempotencyKey?: string;
}

/**
 * Top-level domains reserved so they can never receive email (RFC 2606 and RFC 6761). Demo and test accounts use
 * them (host@mabeet.test), so sending there would only fail or bounce.
 */
const RESERVED_DOMAIN = /\.(test|example|invalid|localhost)$/i;

const canReceiveEmail = (address: string) => !RESERVED_DOMAIN.test(address.trim());

/**
 * Sends one email through Resend. Without RESEND_API_KEY it prints the email's text in the log instead, links and
 * all, so local development needs no account and a new account can still be confirmed. Addresses on reserved test
 * domains are skipped.
 */
export async function sendEmail(email: Email): Promise<void> {
  const recipients = (Array.isArray(email.to) ? email.to : [email.to]).filter(canReceiveEmail);
  if (recipients.length === 0) {
    console.warn(`[email not sent: only test addresses] to=${String(email.to)} subject="${email.subject}"`);
    return;
  }
  if (!env.RESEND_API_KEY) {
    console.warn(
      `[email not sent: RESEND_API_KEY is empty] to=${recipients.join(",")} subject="${email.subject}"\n${email.text}`,
    );
    return;
  }
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      ...(email.idempotencyKey && { "idempotency-key": email.idempotencyKey }),
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: recipients,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo && { reply_to: email.replyTo }),
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Resend refused the email (${response.status}): ${await response.text().catch(() => "")}`,
    );
  }
}
