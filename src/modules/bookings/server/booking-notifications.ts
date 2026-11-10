import type { BookingMode, BookingStatus, FeedSource } from "@prisma/client";
import { isOnlineMode } from "@/config/enums";
import { noticeAsPush, pushToPeople } from "@/modules/notifications/server";
import { listPeopleWhoDecideBookings } from "@/modules/team/server";
import { prisma } from "@/server/db/client";
import { appUrl, firstName, type NoticeLanguage, noticeLanguage, queueNotice } from "@/server/email/notices";
import { sendEmail } from "@/server/email/send";
import { type Message, render } from "@/server/email/templates";
import { defineJob } from "@/server/jobs/queue";
import { formatMoney, formatStayDates } from "@/utils/format";
import { findBookingForNotice, findImportClashForNotice } from "./booking-repository";
import { findSessionBookingForNotice } from "./session-booking-repository";

// The booking engine's emails. Every notify* function puts a job on the "notify" queue and never throws: a mail
// outage must not undo or slow down a booking, and the worker retries a failed delivery. Jobs carry only ids; the
// worker loads the booking fresh and sends nothing when the news no longer holds. The guest gets the language they
// booked in; each host gets their own account's language. Seats in a session hear the same news as a stay, in the
// words for seats.

type Lang = NoticeLanguage;

/** A stay, or seats in a session of an experience or service. Job data that names neither is a stay. */
export type BookingKind = "stay" | "session";

const LABELS = {
  en: {
    place: "Place",
    room: "Room",
    dates: "Dates",
    guests: "Guests",
    total: "Total",
    reference: "Reference",
    offering: "Booked",
    when: "When",
  },
  ar: {
    place: "المكان",
    room: "الغرفة",
    dates: "التواريخ",
    guests: "الضيوف",
    total: "المجموع",
    reference: "رقم الحجز",
    offering: "المحجوز",
    when: "الموعد",
  },
} as const;

/** What a booking holds, as the emails name it: the guest's room, or their seats. */
const HELD_WORDS = {
  stay: {
    en: { yours: "your room", the: "the room", is: "is", freed: "The nights are free again." },
    ar: { yours: "غرفتك", the: "الغرفة", is: "", freed: "الليالي متاحة من جديد." },
  },
  session: {
    en: { yours: "your seats", the: "the seats", is: "are", freed: "The seats are free again." },
    ar: { yours: "مقاعدك", the: "المقاعد", is: "", freed: "المقاعد متاحة من جديد." },
  },
} as const;

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Letter = { subject: string; idempotencyKey: string; message: Message };

/** What a stay and seats in a session share, as their notice rows read. */
interface NoticeRow {
  id: string;
  status: BookingStatus;
  reference: string;
  publicToken: string;
  locale: string;
  guestUserId: string;
  guestName: string;
  guestEmail: string | null;
  guestNote: string | null;
  bookingMode: BookingMode;
  holdExpiresAt: Date | null;
  cancelReason: string | null;
  totalCents: number;
  currency: string;
  guestUser: { email: string; isDeleted: boolean };
  business: { id: string; name: string; timezone: string; paymentInstructions: string | null };
  payments: ReadonlyArray<{ id: string }>;
}

/** Times read in the place's own time zone, wherever the reader is. */
const placeTime = (timeZone: string) => (date: Date, l: Lang) =>
  new Intl.DateTimeFormat(l, { dateStyle: "medium", timeStyle: "short", timeZone }).format(date);

/** A booking as the emails read it: a stay, or seats in a session. */
async function loadNotice(bookingId: string, kind: BookingKind = "stay") {
  if (kind === "session") {
    const booking = await findSessionBookingForNotice(prisma, bookingId);
    if (!booking) return null;
    const when = (l: Lang) => placeTime(booking.business.timezone)(booking.session.startsAt, l);
    return noticeOf(booking, kind, when, (l) => [
      { label: LABELS[l].offering, value: booking.offering.title },
      { label: LABELS[l].when, value: when(l) },
      { label: LABELS[l].guests, value: String(booking.seats) },
    ]);
  }
  const booking = await findBookingForNotice(prisma, bookingId);
  if (!booking) return null;
  const when = (l: Lang) => formatStayDates(booking.checkIn, booking.checkOut, l);
  return noticeOf(booking, kind, when, (l) => [
    { label: LABELS[l].room, value: booking.room.name },
    { label: LABELS[l].dates, value: when(l) },
    { label: LABELS[l].guests, value: String(booking.guestCount) },
  ]);
}

function noticeOf(
  booking: NoticeRow,
  kind: BookingKind,
  when: (l: Lang) => string,
  booked: (l: Lang) => Array<{ label: string; value: string }>,
) {
  return {
    id: booking.id,
    kind,
    status: booking.status,
    reference: booking.reference,
    publicToken: booking.publicToken,
    businessId: booking.business.id,
    businessName: booking.business.name,
    paymentInstructions: booking.business.paymentInstructions,
    locale: noticeLanguage(booking.locale),
    guestUserId: booking.guestUserId,
    guestName: booking.guestName,
    // A closed account's email is a placeholder, so then only the address typed on the booking is used.
    guestEmail: booking.guestEmail ?? (booking.guestUser.isDeleted ? null : booking.guestUser.email),
    guestNote: booking.guestNote,
    online: isOnlineMode(booking.bookingMode),
    paid: booking.payments.length > 0,
    holdExpiresAt: booking.holdExpiresAt,
    cancelReason: booking.cancelReason,
    time: placeTime(booking.business.timezone),
    total: (l: Lang) => formatMoney(booking.totalCents, booking.currency, l),
    when,
    held: (l: Lang) => HELD_WORDS[kind][l],
    details: (l: Lang) => [
      { label: LABELS[l].place, value: booking.business.name },
      ...booked(l),
      { label: LABELS[l].total, value: formatMoney(booking.totalCents, booking.currency, l) },
      { label: LABELS[l].reference, value: booking.reference },
    ],
  };
}

type Notice = NonNullable<Awaited<ReturnType<typeof loadNotice>>>;

const bookingPage = (notice: Notice) => appUrl(`/b/${notice.publicToken}`);
const bookingsPage = (businessId: string) => appUrl(`/dashboard/${businessId}/bookings`);

/**
 * Tells the people who can decide bookings: one email per language, then a push to each of their devices in their
 * own language. The push comes after the emails, so a retried email never pushes twice.
 */
async function tellHosts(businessId: string, build: (l: Lang) => Letter) {
  const hosts = await listPeopleWhoDecideBookings(businessId);
  const languages = [...new Set(hosts.map((host) => noticeLanguage(host.locale)))];
  await Promise.all(
    languages.map((l) => {
      const { subject, idempotencyKey, message } = build(l);
      return sendEmail({
        to: hosts.filter((host) => noticeLanguage(host.locale) === l).map((host) => host.email),
        idempotencyKey: `${idempotencyKey}-${l}`,
        ...render(subject, message, l),
      });
    }),
  );
  const languageOf = new Map(hosts.map((host) => [host.id, noticeLanguage(host.locale)]));
  await pushToPeople(
    hosts.map((host) => host.id),
    (userId) => noticeAsPush(build(languageOf.get(userId) ?? "en").message),
  );
}

/** Tells the guest by email, when there is an address to write to, then on every device of their account. */
async function tellGuest(notice: Notice, { subject, idempotencyKey, message }: Letter) {
  if (notice.guestEmail) {
    await sendEmail({ to: notice.guestEmail, idempotencyKey, ...render(subject, message, notice.locale) });
  }
  await pushToPeople([notice.guestUserId], () => noticeAsPush(message));
}

// ---------- A request waiting for the owner ----------

/**
 * A booking now waits for the owner: a new offline request, or (mode 2) a request the guest just paid for. The
 * guest gets a receipt, and the people who can decide get a nudge.
 */
export function notifyBookingRequested(bookingId: string, kind: BookingKind = "stay"): void {
  queueNotice(bookingRequested, { bookingId, kind });
}

const bookingRequested = defineJob(
  "notify",
  "notify.booking-requested",
  async ({ bookingId, kind }: { bookingId: string; kind?: BookingKind }) => {
    const notice = await loadNotice(bookingId, kind);
    // Decided, cancelled or expired before the worker got to it: the status email says so instead.
    if (notice?.status !== "HELD") return;
    const l = notice.locale;
    const until = notice.holdExpiresAt ? notice.time(notice.holdExpiresAt, l) : null;
    const total = notice.total(l);
    const held = notice.held(l);
    const guestCopy =
      l === "ar"
        ? {
            subject: `طلبك لدى ${notice.businessName} (${notice.reference})`,
            kicker: "طلب حجز",
            title: `${held.yours} لدى ${notice.businessName} محجوزة لك`,
            body: [
              `مرحبًا ${firstName(notice.guestName)}، وصل طلبك إلى المضيف. لا يمكن لأحد آخر أخذ ${held.yours} ريثما يقرّر${until ? ` (حتى ${until})` : ""}.`,
              notice.paid
                ? `دفعت المبلغ كاملًا ${total}. إن رفض المضيف أو لم يردّ في الوقت المحدد، يُعاد إليك المبلغ كاملًا تلقائيًا.`
                : `بعد أن يؤكّد المضيف، تدفع له المبلغ كاملًا ${total} مباشرةً. ${notice.paymentInstructions ?? "سيخبرك المضيف بطريقة الدفع."}`,
            ],
            action: "اعرض حجزك",
            footnote: "احتفظ بهذا البريد: الرابط يعرض دائمًا آخر حالة لحجزك.",
          }
        : {
            subject: `Your request to ${notice.businessName} (${notice.reference})`,
            kicker: "Booking request",
            title: `${capitalized(held.yours)} at ${notice.businessName} ${held.is} held`,
            body: [
              `Hi ${firstName(notice.guestName)}, the host has your request. Nobody else can take ${held.yours} while they decide${until ? ` (until ${until})` : ""}.`,
              notice.paid
                ? `You paid the full ${total}. If the host declines or doesn't answer in time, you get it all back automatically.`
                : `Once the host confirms, you pay them the full ${total} directly. ${notice.paymentInstructions ?? "The host will tell you how to pay."}`,
            ],
            action: "See your booking",
            footnote: "Keep this email: the link always shows your booking's latest status.",
          };
    await Promise.all([
      tellGuest(notice, {
        subject: guestCopy.subject,
        idempotencyKey: `requested-guest-${notice.id}`,
        message: {
          kicker: guestCopy.kicker,
          title: guestCopy.title,
          body: guestCopy.body,
          details: notice.details(l),
          action: { label: guestCopy.action, url: bookingPage(notice) },
          footnote: guestCopy.footnote,
        },
      }),
      tellHosts(notice.businessId, (hl) => {
        const answerBy = notice.holdExpiresAt ? notice.time(notice.holdExpiresAt, hl) : null;
        const hostHeld = notice.held(hl);
        return {
          subject:
            hl === "ar"
              ? `طلب جديد: ${notice.guestName}، ${notice.when(hl)}`
              : `New request: ${notice.guestName}, ${notice.when(hl)}`,
          idempotencyKey: `requested-host-${notice.id}`,
          message: {
            kicker: hl === "ar" ? "طلب جديد" : "New request",
            title: hl === "ar" ? `${notice.guestName} يريد الحجز` : `${notice.guestName} wants to book`,
            body: [
              hl === "ar"
                ? `${hostHeld.the} محجوزة للضيف إلى أن تؤكّد أو ترفض${answerBy ? `، حتى ${answerBy}` : ""}. إن لم تردّ، ينتهي الطلب وتعود ${hostHeld.the} متاحة.`
                : `${capitalized(hostHeld.the)} ${hostHeld.is} held for the guest until you confirm or decline${answerBy ? `, until ${answerBy}` : ""}. If you don't answer, the request ends and ${hostHeld.the} ${hostHeld.is} free again.`,
              notice.paid
                ? hl === "ar"
                  ? `دفع الضيف المبلغ كاملًا ${notice.total(hl)} عبر الإنترنت. إن رفضت أو لم تردّ، يُعاد إليه كاملًا.`
                  : `The guest paid the full ${notice.total(hl)} online. If you decline or don't answer, it is refunded in full.`
                : hl === "ar"
                  ? `يدفع لك الضيف ${notice.total(hl)} مباشرةً بعد أن تؤكّد.`
                  : `The guest pays you ${notice.total(hl)} directly once you confirm.`,
              ...(notice.guestNote
                ? [hl === "ar" ? `ملاحظته: «${notice.guestNote}»` : `Their note: "${notice.guestNote}"`]
                : []),
            ],
            details: notice.details(hl),
            action: {
              label: hl === "ar" ? "أجب على الطلب" : "Answer the request",
              url: bookingsPage(notice.businessId),
            },
          },
        };
      }),
    ]);
  },
);

// ---------- What the guest hears when the status changes ----------

type StatusCopy = { subject: string; title: string; body: string[] };

function statusCopy(notice: Notice, l: Lang): StatusCopy | null {
  const total = notice.total(l);
  const held = notice.held(l);
  const refund =
    l === "ar"
      ? `يُعاد إليك المبلغ الذي دفعته عبر الإنترنت (${total}) كاملًا وتلقائيًا.`
      : `What you paid online (${total}) is refunded to you in full, automatically.`;
  switch (notice.status) {
    case "AWAITING_PAYMENT":
      return l === "ar"
        ? {
            subject: "ادفع لتثبيت حجزك",
            title: `${held.yours} محجوزة لك ريثما تدفع`,
            body: [
              `ادفع المبلغ كاملًا ${total} عبر الإنترنت من صفحة حجزك، بـ Whish أو بالبطاقة${notice.holdExpiresAt ? `، قبل ${notice.time(notice.holdExpiresAt, l)}` : ""}. إن لم يصل الدفع في الوقت المحدد، تعود ${held.the} متاحة.`,
            ],
          }
        : {
            subject: "Pay to secure your booking",
            title: `${capitalized(held.yours)} ${held.is} held while you pay`,
            body: [
              `Pay the full ${total} online from your booking page, with Whish or a card${notice.holdExpiresAt ? `, before ${notice.time(notice.holdExpiresAt, l)}` : ""}. If no payment arrives in time, ${held.the} ${held.is} free again.`,
            ],
          };
    case "CONFIRMED":
      return l === "ar"
        ? {
            subject: "تم التأكيد",
            title: "أنت ذاهب! تم تأكيد حجزك",
            body: [
              notice.paid
                ? "حجزك مؤكّد ومدفوع بالكامل. راسل المضيف إن كان لديك أي سؤال قبل الموعد."
                : `حجزك مؤكّد. ادفع للمضيف ${total} مباشرةً. ${notice.paymentInstructions ?? "سيخبرك المضيف بطريقة الدفع."}`,
            ],
          }
        : {
            subject: "Confirmed",
            title: "You're going! Your booking is confirmed",
            body: [
              notice.paid
                ? "Your booking is confirmed and paid in full. Message the host if you have any questions before the day."
                : `Your booking is confirmed. Pay the host ${total} directly. ${notice.paymentInstructions ?? "The host will tell you how to pay."}`,
            ],
          };
    case "DECLINED":
      return l === "ar"
        ? {
            subject: "غير متاح",
            title: "لم يتمكّن المضيف من قبول هذا الحجز",
            body: [
              "لم يعد هناك شيء محجوز لك. قد تكون تواريخ أو أماكن أخرى متاحة.",
              ...(notice.paid ? [refund] : []),
            ],
          }
        : {
            subject: "Not available",
            title: "The host couldn't take this booking",
            body: [
              "Nothing is held for you any more. Other dates or places may still be free.",
              ...(notice.paid ? [refund] : []),
            ],
          };
    case "CANCELLED":
      return l === "ar"
        ? {
            subject: "أُلغي",
            title: "تم إلغاء حجزك",
            body: ["أُلغي حجزك.", ...(notice.paid ? [refund] : [])],
          }
        : {
            subject: "Cancelled",
            title: "Your booking was cancelled",
            body: ["Your booking has been cancelled.", ...(notice.paid ? [refund] : [])],
          };
    case "EXPIRED": {
      // Unpaid in an online mode: the payment window ran out. Otherwise the owner never answered.
      const unpaid = notice.online && !notice.paid;
      if (l === "ar") {
        return unpaid
          ? {
              subject: "انتهت مهلة الدفع",
              title: "انتهى الوقت المحدد للدفع",
              body: [
                `لم يصل الدفع في الوقت المحدد، فعادت ${held.the} متاحة ولم يُخصم منك أي مبلغ. يمكنك الحجز مجددًا.`,
              ],
            }
          : {
              subject: "انتهت مهلة الطلب",
              title: "انتهت مهلة طلبك",
              body: [
                "لم يجب المضيف في الوقت المحدد، فانتهى الحجز المؤقت. يمكنك الطلب مجددًا أو تجربة مكان آخر.",
                ...(notice.paid ? [refund] : []),
              ],
            };
      }
      return unpaid
        ? {
            subject: "Payment time ran out",
            title: "The time to pay ran out",
            body: [
              `No payment arrived in time, so ${held.the} ${held.is} free again and you were not charged. You can book again.`,
            ],
          }
        : {
            subject: "Request expired",
            title: "Your request expired",
            body: [
              "The host didn't answer in time, so the hold ended. You can request again, or try another place.",
              ...(notice.paid ? [refund] : []),
            ],
          };
    }
    default:
      return null;
  }
}

/** Tells the guest their booking moved: waiting for payment, confirmed, declined, cancelled or expired. */
export function notifyBookingStatus(bookingId: string, kind: BookingKind = "stay"): void {
  queueNotice(bookingStatus, { bookingId, kind });
}

const LIVE_STATUSES: readonly BookingStatus[] = ["AWAITING_PAYMENT", "CONFIRMED"];

const bookingStatus = defineJob(
  "notify",
  "notify.booking-status",
  async ({ bookingId, kind }: { bookingId: string; kind?: BookingKind }) => {
    const notice = await loadNotice(bookingId, kind);
    if (!notice) return;
    const l = notice.locale;
    const copy = statusCopy(notice, l);
    if (!copy) return;
    const reason =
      notice.status === "CANCELLED" && notice.cancelReason
        ? [`${l === "ar" ? "السبب" : "Reason"}: ${notice.cancelReason}`]
        : [];
    await tellGuest(notice, {
      subject: `${copy.subject}: ${notice.businessName} (${notice.reference})`,
      idempotencyKey: `status-${notice.status}-${notice.id}`,
      message: {
        kicker: copy.subject,
        title: copy.title,
        body: [...copy.body, ...reason],
        details: notice.details(l),
        action: LIVE_STATUSES.includes(notice.status)
          ? { label: l === "ar" ? "اعرض حجزك" : "See your booking", url: bookingPage(notice) }
          : { label: l === "ar" ? "ابحث عن مكان آخر" : "Find another place", url: appUrl("/search") },
      },
    });
  },
);

// ---------- The guest cancelled ----------

/** The guest cancelled from their booking page: the people who can decide bookings are told. */
export function notifyGuestCancelled(bookingId: string, kind: BookingKind = "stay"): void {
  queueNotice(guestCancelled, { bookingId, kind });
}

const guestCancelled = defineJob(
  "notify",
  "notify.guest-cancelled",
  async ({ bookingId, kind }: { bookingId: string; kind?: BookingKind }) => {
    const notice = await loadNotice(bookingId, kind);
    if (notice?.status !== "CANCELLED") return;
    await tellHosts(notice.businessId, (l) => ({
      subject:
        l === "ar"
          ? `ألغاه الضيف: ${notice.guestName}، ${notice.when(l)}`
          : `Cancelled by the guest: ${notice.guestName}, ${notice.when(l)}`,
      idempotencyKey: `guest-cancelled-${notice.id}`,
      message: {
        kicker: l === "ar" ? "إلغاء من الضيف" : "Guest cancelled",
        title: l === "ar" ? `ألغى ${notice.guestName} الحجز` : `${notice.guestName} cancelled`,
        body: [
          l === "ar"
            ? `ألغى الضيف من صفحة حجزه. ${notice.held(l).freed}`
            : `The guest cancelled from their booking page. ${notice.held(l).freed}`,
          ...(notice.paid
            ? [
                l === "ar"
                  ? "يُعاد للضيف ما دفعه عبر الإنترنت كاملًا."
                  : "What they paid online is refunded to them in full.",
              ]
            : []),
          ...(notice.cancelReason
            ? [l === "ar" ? `سببه: «${notice.cancelReason}»` : `Their reason: "${notice.cancelReason}"`]
            : []),
        ],
        details: notice.details(l),
        action: {
          label: l === "ar" ? "افتح الحجوزات" : "Open bookings",
          url: bookingsPage(notice.businessId),
        },
      },
    }));
  },
);

// ---------- Paid online ----------

/** Mode 1: the guest paid and the booking confirmed itself. Nobody has to answer, but the hosts should know. */
export function notifyHostsNewBooking(bookingId: string, kind: BookingKind = "stay"): void {
  queueNotice(hostsNewBooking, { bookingId, kind });
}

const hostsNewBooking = defineJob(
  "notify",
  "notify.hosts-new-booking",
  async ({ bookingId, kind }: { bookingId: string; kind?: BookingKind }) => {
    const notice = await loadNotice(bookingId, kind);
    if (notice?.status !== "CONFIRMED") return;
    await tellHosts(notice.businessId, (l) => ({
      subject:
        l === "ar"
          ? `حجز جديد مدفوع: ${notice.guestName}، ${notice.when(l)}`
          : `New paid booking: ${notice.guestName}, ${notice.when(l)}`,
      idempotencyKey: `hosts-new-booking-${notice.id}`,
      message: {
        kicker: l === "ar" ? "حجز تلقائي" : "Automatic booking",
        title: l === "ar" ? `${notice.guestName} حجز ودفع` : `${notice.guestName} booked and paid`,
        body: [
          l === "ar"
            ? `دفع الضيف المبلغ كاملًا ${notice.total(l)} عبر الإنترنت، فتأكّد الحجز تلقائيًا. لا شيء عليك فعله.`
            : `The guest paid the full ${notice.total(l)} online, so the booking confirmed itself. There is nothing for you to do.`,
        ],
        details: notice.details(l),
        action: {
          label: l === "ar" ? "افتح الحجوزات" : "Open bookings",
          url: bookingsPage(notice.businessId),
        },
      },
    }));
  },
);

/** A payment arrived after the booking had ended, or on a booking already paid: the guest gets it all back. */
export function notifyLatePaymentRefunded(
  bookingId: string,
  paymentId: string,
  kind: BookingKind = "stay",
): void {
  queueNotice(latePaymentRefunded, { bookingId, paymentId, kind });
}

const latePaymentRefunded = defineJob(
  "notify",
  "notify.late-payment-refunded",
  async ({ bookingId, paymentId, kind }: { bookingId: string; paymentId: string; kind?: BookingKind }) => {
    const notice = await loadNotice(bookingId, kind);
    if (!notice) return;
    const l = notice.locale;
    await tellGuest(notice, {
      subject:
        l === "ar"
          ? `نعيد إليك دفعتك: ${notice.businessName} (${notice.reference})`
          : `We are refunding your payment: ${notice.businessName} (${notice.reference})`,
      idempotencyKey: `late-payment-${paymentId}`,
      message: {
        kicker: l === "ar" ? "استرداد" : "Refund",
        title:
          l === "ar" ? "وصلت دفعتك بعد انتهاء الحجز" : "Your payment arrived after the booking had ended",
        body: [
          l === "ar"
            ? "لم يعد هذا الحجز قائمًا، أو كان مدفوعًا من قبل، لذا يُعاد إليك المبلغ الذي دفعته كاملًا وتلقائيًا."
            : "This booking was no longer open, or was already paid, so what you paid is refunded to you in full, automatically.",
        ],
        details: notice.details(l),
        action: { label: l === "ar" ? "اعرض حجزك" : "See your booking", url: bookingPage(notice) },
      },
    });
  },
);

// ---------- A platform stay over our nights ----------

const SOURCE_NAMES: Record<Lang, Record<FeedSource, string>> = {
  en: { AIRBNB: "Airbnb", BOOKING: "Booking.com", OTHER: "Another platform" },
  ar: { AIRBNB: "Airbnb", BOOKING: "Booking.com", OTHER: "منصّة أخرى" },
};

/**
 * A platform's calendar has a stay over nights we already sold or closed. Nothing was cancelled; the people who
 * decide bookings hear about it once, when the clash appears. `at` is that moment, so a clash that clears and
 * comes back is announced again.
 */
export function notifyImportClash(occupancyId: string, at: Date): void {
  queueNotice(importClash, { occupancyId, at: at.toISOString() });
}

const importClash = defineJob(
  "notify",
  "notify.import-conflict",
  async ({ occupancyId, at }: { occupancyId: string; at: string }) => {
    const clash = await findImportClashForNotice(prisma, occupancyId);
    // Settled before the worker got to it: either side was cancelled, or the platform moved the dates.
    if (!clash?.active || !clash.conflict) return;
    const source = clash.feed?.source ?? "OTHER";
    const takenBy = (l: Lang) =>
      clash.clashes
        .map((own) =>
          own.booking
            ? `${own.booking.guestName} (${own.booking.reference})`
            : (own.note ?? (l === "ar" ? "أيام مغلقة" : "Closed dates")),
        )
        .join(l === "ar" ? "، " : ", ");
    await tellHosts(clash.business.id, (l) => {
      const platform = SOURCE_NAMES[l][source];
      const dates = formatStayDates(clash.checkIn, clash.checkOut, l);
      return {
        subject:
          l === "ar"
            ? `تعارض في التقويم: حجز من ${platform} في ${clash.room.name}، ${dates}`
            : `Calendar clash: a ${platform} booking in ${clash.room.name}, ${dates}`,
        idempotencyKey: `import-conflict-${clash.id}-${at}`,
        message: {
          kicker: l === "ar" ? "تعارض في التقويم" : "Calendar clash",
          title:
            l === "ar"
              ? `حجز من ${platform} على ليالٍ محجوزة لديك`
              : `A ${platform} booking landed on nights you already sold`,
          body: [
            l === "ar"
              ? `أرسل ${platform} حجزًا لليالٍ محجوزة أو مغلقة هنا. لم يُلغَ شيء: الإقامتان ظاهرتان في تقويمك حتى تحسم الأمر.`
              : `${platform} sent a booking for nights that are already booked or closed here. Nothing was cancelled: both stays are in your calendar until you settle it.`,
            l === "ar"
              ? `ألغِ أحد الحجزين، على ${platform} أو هنا، ويختفي التعارض.`
              : `Cancel one of them, on ${platform} or here, and the clash clears.`,
          ],
          details: [
            { label: LABELS[l].place, value: clash.business.name },
            { label: LABELS[l].room, value: clash.room.name },
            { label: platform, value: dates },
            { label: l === "ar" ? "يتعارض مع" : "Clashes with", value: takenBy(l) },
          ],
          action: {
            label: l === "ar" ? "افتح التقويم" : "Open calendar",
            url: appUrl(`/dashboard/${clash.business.id}/calendar`),
          },
        },
      };
    });
  },
);
