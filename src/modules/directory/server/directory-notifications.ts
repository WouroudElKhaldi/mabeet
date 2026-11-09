import type { Locale } from "@/config/appearance";
import { noticeAsPush, pushToPeople } from "@/modules/notifications/server";
import { listPeopleWhoDecideBookings } from "@/modules/team/server";
import { getHostSection } from "@/modules/workspaces/server";
import { type NoticeLanguage, noticeLanguage, queueNotice } from "@/server/email/notices";
import { sendEmail } from "@/server/email/send";
import { type Message, render } from "@/server/email/templates";
import { defineJob } from "@/server/jobs/queue";
import { parseIsoDate } from "@/utils/dates";
import { formatStayDates } from "@/utils/format";
import { acceptsMessages } from "../host";

// The email a Contact host question becomes. Nothing is stored: the question goes to the people who can decide the
// place's bookings, with the guest as the reply address, so answering the email reaches the guest. The job carries
// the question itself (plain values: there is no row to load) and never throws at the request: the worker retries a
// failed delivery.

interface HostMessageData {
  businessId: string;
  placeName: string;
  name: string;
  email: string;
  message: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  /** The guest's language, so the host knows which language to answer in. */
  locale: Locale;
  /** One per question, so a retried delivery is never sent twice. */
  reference: string;
}

const COPY = {
  en: {
    kicker: "Contact host",
    subject: (place: string, name: string) => `Question about ${place} from ${name}`,
    title: (name: string) => `${name} has a question`,
    from: "From",
    dates: "Dates",
    guests: "Guests",
    language: "Language",
    footnote: "Reply to this email to answer them directly.",
    languages: { en: "English", ar: "Arabic", "ar-LB": "Lebanese Arabic" },
  },
  ar: {
    kicker: "تواصل مع المضيف",
    subject: (place: string, name: string) => `سؤال عن ${place} من ${name}`,
    title: (name: string) => `${name} عنده سؤال`,
    from: "من",
    dates: "التواريخ",
    guests: "الضيوف",
    language: "اللغة",
    footnote: "ردّ على هذا البريد لتجيبه مباشرة.",
    languages: { en: "الإنجليزية", ar: "العربية", "ar-LB": "اللبنانية" },
  },
} as const;

function letter(data: HostMessageData, l: NoticeLanguage): { subject: string; message: Message } {
  const copy = COPY[l];
  const stay =
    data.checkIn && data.checkOut
      ? [
          {
            label: copy.dates,
            value: formatStayDates(parseIsoDate(data.checkIn), parseIsoDate(data.checkOut), l),
          },
        ]
      : [];
  return {
    subject: copy.subject(data.placeName, data.name),
    message: {
      kicker: `${copy.kicker} · ${data.placeName}`,
      title: copy.title(data.name),
      body: data.message.split(/\n+/).filter((line) => line.trim() !== ""),
      details: [
        { label: copy.from, value: `${data.name} <${data.email}>` },
        ...stay,
        ...(data.guests ? [{ label: copy.guests, value: String(data.guests) }] : []),
        { label: copy.language, value: copy.languages[data.locale] },
      ],
      footnote: copy.footnote,
    },
  };
}

/** Sends a guest's question to the place's hosts, by email and on their devices. */
export function notifyHostMessage(data: HostMessageData): void {
  queueNotice(hostMessageEmail, data);
}

const hostMessageEmail = defineJob("notify", "notify.host-message", async (data: HostMessageData) => {
  // The host switched to WhatsApp only after the question was accepted: they asked not to get these.
  if (!acceptsMessages((await getHostSection(data.businessId)).contactBy)) return;
  const hosts = await listPeopleWhoDecideBookings(data.businessId);
  const languages = [...new Set(hosts.map((host) => noticeLanguage(host.locale)))];
  await Promise.all(
    languages.map((l) => {
      const { subject, message } = letter(data, l);
      return sendEmail({
        to: hosts.filter((host) => noticeLanguage(host.locale) === l).map((host) => host.email),
        replyTo: data.email,
        idempotencyKey: `host-message-${data.reference}-${l}`,
        ...render(subject, message, l),
      });
    }),
  );
  // After the emails, so a retried email never pushes twice.
  const languageOf = new Map(hosts.map((host) => [host.id, noticeLanguage(host.locale)]));
  await pushToPeople(
    hosts.map((host) => host.id),
    (userId) => noticeAsPush(letter(data, languageOf.get(userId) ?? "en").message),
  );
});
