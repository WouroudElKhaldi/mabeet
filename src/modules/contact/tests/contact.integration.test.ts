import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as contactRoute from "@/app/api/public/contact/route";
import { settleBackgroundWork } from "@/server/background";
import type { Email } from "@/server/email/send";
import { env } from "@/server/env";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";

// The Contact page form: a visitor's message reaches the team's inbox as an email they can answer with Reply, only
// while an inbox is set, and one address cannot flood it.

const sent = vi.hoisted(() => [] as Email[]);
vi.mock(import("@/server/email/send"), async (importOriginal) => ({
  ...(await importOriginal()),
  sendEmail: vi.fn(async (email: Email) => {
    sent.push(email);
  }),
}));

const TEAM_INBOX = "team@mabeet.app";
const saved = env.CONTACT_EMAIL;

const message = {
  name: "Rana Khalil",
  email: "rana@example.com",
  topic: "hosting",
  message: "Hello, I run a guesthouse in Batroun.\nCan I list it on Mabeet?",
};

/** Posts the form from one visitor's address, in Arabic, the way the browser does. */
async function postMessage(body: unknown, address = "203.0.113.7") {
  const request = new Request("http://localhost/api/public/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": address, cookie: "locale=ar" },
    body: JSON.stringify(body),
  });
  const response = await contactRoute.POST(request, { params: Promise.resolve({}) });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  env.CONTACT_EMAIL = TEAM_INBOX;
});

afterEach(async () => {
  await settleBackgroundWork();
  sent.length = 0;
  env.CONTACT_EMAIL = saved;
  resetMemoryRateLimits();
});

describe("the contact form", () => {
  it("sends the message to the team's inbox, with the visitor as the reply address", async () => {
    const response = await postMessage(message);
    expect(response).toEqual({ status: 202, body: { sent: true } });

    await settleBackgroundWork();
    expect(sent).toHaveLength(1);
    const [email] = sent;
    expect(email).toMatchObject({ to: TEAM_INBOX, replyTo: "rana@example.com" });
    expect(email?.subject).toBe("Contact: Listing a place, from Rana Khalil");
    // Each line of the message is its own paragraph; the topic and the visitor's language are in the details.
    expect(email?.text).toContain("Hello, I run a guesthouse in Batroun.");
    expect(email?.text).toContain("Can I list it on Mabeet?");
    expect(email?.text).toContain("Arabic");
    expect(email?.idempotencyKey).toMatch(/^contact-/);
  });

  it("refuses the message while no team inbox is set, so nothing is accepted and then lost", async () => {
    env.CONTACT_EMAIL = undefined;
    const response = await postMessage(message);
    expect(response.status).toBe(503);
    await settleBackgroundWork();
    expect(sent).toHaveLength(0);
  });

  it("names the wrong fields, and sends nothing", async () => {
    const response = await postMessage({ name: "R", email: "not-an-email", topic: "other", message: "Hi" });
    expect(response.status).toBe(400);
    const details = (response.body.error as { details: { fieldErrors: Record<string, unknown> } }).details;
    expect(Object.keys(details.fieldErrors).sort()).toEqual(["email", "message", "name"]);
    await settleBackgroundWork();
    expect(sent).toHaveLength(0);
  });

  it("takes five messages an hour from one address, then asks to slow down", async () => {
    for (let count = 0; count < 5; count++) expect((await postMessage(message)).status).toBe(202);
    expect((await postMessage(message)).status).toBe(429);
    // Someone else is not held back by it.
    expect((await postMessage(message, "198.51.100.4")).status).toBe(202);
  });
});
