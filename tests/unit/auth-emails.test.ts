import { afterEach, describe, expect, it, vi } from "vitest";
import type { Email } from "@/server/email/send";

const sent = vi.hoisted(() => [] as Email[]);
vi.mock("@/server/env", () => ({ env: { BETTER_AUTH_URL: "https://mabeet.app" } }));
vi.mock("@/server/email/send", () => ({
  sendEmail: vi.fn(async (email: Email) => {
    sent.push(email);
  }),
}));

const { sendPasswordResetEmail, sendVerificationEmail } = await import("@/server/email/auth-emails");

afterEach(() => {
  sent.length = 0;
});

describe("sign-in emails", () => {
  it("sends the confirmation link, greeting the person by first name", async () => {
    await sendVerificationEmail("maya@guesthouse.lb", "Maya Haddad", "https://mabeet.app/verify?t=1");
    const [email] = sent;
    expect(email?.to).toBe("maya@guesthouse.lb");
    expect(email?.subject).toBe("Confirm your email");
    expect(email?.text).toContain("Welcome, Maya");
    expect(email?.text).toContain("https://mabeet.app/verify?t=1");
  });

  it("writes to an Arabic speaker in Arabic, right to left", async () => {
    await sendPasswordResetEmail(
      "karim@guesthouse.lb",
      "Karim Saad",
      "https://mabeet.app/reset?t=2",
      "ar-LB",
    );
    const [email] = sent;
    expect(email?.subject).toBe("أعد تعيين كلمة المرور");
    expect(email?.html).toContain('dir="rtl"');
    expect(email?.text).toContain("https://mabeet.app/reset?t=2");
  });

  it("falls back to English when the language is unknown", async () => {
    await sendPasswordResetEmail("rana@guesthouse.lb", "Rana", "https://mabeet.app/reset?t=3", null);
    expect(sent[0]?.subject).toBe("Reset your password");
  });
});
