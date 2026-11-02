import type { z } from "zod";
import type { Locale } from "@/config/appearance";
import { env } from "@/server/env";
import { unavailable } from "@/server/errors";
import { secureToken } from "@/utils/tokens";
import type { contactMessage } from "../schemas";
import { notifyContactMessage } from "./contact-notifications";

// Messages to the Mabeet team from the Contact page. Nothing is stored: the message goes straight to the team's
// inbox (CONTACT_EMAIL) as an email whose reply goes back to the sender.

type ContactMessage = z.infer<typeof contactMessage>;

/**
 * Sends a visitor's message to the team. Refused while no team inbox is set, so a message is never accepted and
 * then lost. The email is a job: a mail outage does not fail the visitor's request, and the worker retries it.
 */
export function sendContactMessage(input: ContactMessage, locale: Locale): void {
  if (!env.CONTACT_EMAIL)
    throw unavailable("Messages to the Mabeet team are not open yet. Please try again later.");
  // One reference per message, so a retried delivery is never sent twice.
  notifyContactMessage({ ...input, locale, reference: secureToken() });
}
