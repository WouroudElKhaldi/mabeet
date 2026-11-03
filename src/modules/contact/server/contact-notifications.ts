import type { Locale } from "@/config/appearance";
import type { ContactTopic } from "@/config/contact";
import { env } from "@/server/env";
import { queueNotice } from "@/server/email/notices";
import { sendEmail } from "@/server/email/send";
import { render } from "@/server/email/templates";
import { defineJob } from "@/server/jobs/queue";

// The email a Contact page message becomes. The job carries the message itself (plain values: there is no row to
// load) and never throws at the request: the worker retries a failed delivery.

interface ContactMessageData {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
  /** The visitor's language, so the team knows which language to answer in. */
  locale: Locale;
  reference: string;
}

const TOPIC_NAMES: Record<ContactTopic, string> = {
  booking: "A booking",
  hosting: "Listing a place",
  privacy: "Privacy and data",
  other: "Something else",
};

const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "Arabic", "ar-LB": "Lebanese Arabic" };

/** Sends a visitor's message to the team's inbox, with the visitor as the reply address. */
export function notifyContactMessage(data: ContactMessageData): void {
  queueNotice(contactMessageEmail, data);
}

const contactMessageEmail = defineJob(
  "notify",
  "notify.contact-message",
  async ({ name, email, topic, message, locale, reference }: ContactMessageData) => {
    // The inbox was closed after the message was accepted: nowhere to deliver it.
    if (!env.CONTACT_EMAIL) return;
    await sendEmail({
      to: env.CONTACT_EMAIL,
      replyTo: email,
      idempotencyKey: `contact-${reference}`,
      ...render(`Contact: ${TOPIC_NAMES[topic]}, from ${name}`, {
        kicker: "Contact page",
        title: `A message from ${name}`,
        body: message.split(/\n+/).filter((line) => line.trim() !== ""),
        details: [
          { label: "From", value: `${name} <${email}>` },
          { label: "About", value: TOPIC_NAMES[topic] },
          { label: "Language", value: LANGUAGE_NAMES[locale] },
        ],
        footnote: "Reply to this email to answer them directly.",
      }),
    });
  },
);
