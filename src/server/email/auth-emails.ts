import { firstName, noticeLanguage } from "@/server/email/notices";
import { sendEmail } from "@/server/email/send";
import { render } from "@/server/email/templates";

// Sign-in emails are sent at once, not queued, because the person is waiting for the link.

export function sendVerificationEmail(to: string, name: string, link: string, locale?: string | null) {
  const l = noticeLanguage(locale);
  return sendEmail({
    to,
    ...render(
      l === "ar" ? "أكّد بريدك الإلكتروني" : "Confirm your email",
      l === "ar"
        ? {
            kicker: "أهلًا بك",
            title: `أهلًا ${firstName(name)}`,
            body: ["أكّد بريدك الإلكتروني ليتمكّن المضيفون من التواصل معك بشأن حجوزاتك."],
            action: { label: "أكّد بريدي", url: link },
            footnote: "يعمل هذا الرابط لمدة ساعة. إن لم تكن قد سجّلت، تجاهل هذه الرسالة.",
          }
        : {
            kicker: "Welcome",
            title: `Welcome, ${firstName(name)}`,
            body: ["Confirm your email so hosts can reach you about your bookings."],
            action: { label: "Confirm my email", url: link },
            footnote: "This link works for one hour. If you didn't sign up, ignore this email.",
          },
      l,
    ),
  });
}

export function sendPasswordResetEmail(to: string, name: string, link: string, locale?: string | null) {
  const l = noticeLanguage(locale);
  return sendEmail({
    to,
    ...render(
      l === "ar" ? "أعد تعيين كلمة المرور" : "Reset your password",
      l === "ar"
        ? {
            kicker: "كلمة المرور",
            title: `أعد تعيين كلمة مرورك يا ${firstName(name)}`,
            body: ["طلب أحدهم إعادة تعيين كلمة المرور لهذا الحساب. إن كنت أنت، اختر كلمة جديدة أدناه."],
            action: { label: "اختر كلمة مرور جديدة", url: link },
            footnote: "يعمل هذا الرابط لمدة ساعة. إن لم تطلب ذلك، تجاهل الرسالة: تبقى كلمة مرورك كما هي.",
          }
        : {
            kicker: "Password",
            title: `Reset your password, ${firstName(name)}`,
            body: [
              "Someone asked to reset the password for this account. If it was you, choose a new one below.",
            ],
            action: { label: "Choose a new password", url: link },
            footnote:
              "This link works for one hour. If you didn't ask, ignore this email: your password stays the same.",
          },
      l,
    ),
  });
}
